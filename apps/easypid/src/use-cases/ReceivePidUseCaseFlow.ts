import { AusweisAuthFlow, type AusweisAuthFlowOptions, sendCommand } from '@animo-id/expo-ausweis-sdk'
import type { MdocRecord } from '@credo-ts/core'
import type { AppAgent } from '@easypid/agent'
import {
  type OpenId4VcCredentialMetadata,
  type OpenId4VciRequestTokenResponse,
  type OpenId4VciResolvedAuthorizationRequest,
  type OpenId4VciResolvedCredentialOffer,
  type SdJwtVcRecord,
  acquireAccessToken,
} from '@package/agent'

export interface ReceivePidUseCaseFlowOptions
  extends Pick<AusweisAuthFlowOptions, 'onAttachCard' | 'onStatusProgress' | 'onCardAttachedChanged'> {
  agent: AppAgent
  onStateChange?: (newState: ReceivePidUseCaseState) => void
  onEnterPin: (
    options: Parameters<AusweisAuthFlowOptions['onEnterPin']>[0] & {
      currentSessionPinAttempts: number
    }
  ) => string | Promise<string>
  allowSimulatorCard?: boolean
}

export type ReceivePidUseCaseState = 'id-card-auth' | 'acquire-access-token' | 'retrieve-credential' | 'error'

export type CardScanningErrorDetails = Parameters<AusweisAuthFlowOptions['onError']>[0]

// biome-ignore lint/complexity/noBannedTypes: <explanation>
export abstract class ReceivePidUseCaseFlow<ExtraOptions = {}> {
  protected options: ReceivePidUseCaseFlowOptions & ExtraOptions

  protected resolvedCredentialOffer: OpenId4VciResolvedCredentialOffer
  protected resolvedAuthorizationRequest: OpenId4VciResolvedAuthorizationRequest
  protected idCardAuthFlow!: AusweisAuthFlow
  protected accessToken?: OpenId4VciRequestTokenResponse
  protected refreshUrl?: string
  protected currentSessionPinAttempts = 0
  protected authenticationPromise?: Promise<void>
  protected accessRights: Promise<string[]>

  static CLIENT_ID = '7598ca4c-cc2e-4ff1-a4b4-ed58f249e274'

  protected currentState: ReceivePidUseCaseState = 'id-card-auth'
  public get state() {
    return this.currentState
  }

  protected errorCallbacks: AusweisAuthFlowOptions['onError'][] = [(e) => this.handleError(e)]
  protected successCallbacks: AusweisAuthFlowOptions['onSuccess'][] = [
    ({ refreshUrl }) => {
      this.refreshUrl = refreshUrl
      this.assertState({
        expectedState: 'id-card-auth',
        newState: 'acquire-access-token',
      })
    },
  ]

  public abstract retrieveCredentials(): Promise<
    Array<SdJwtVcRecord | MdocRecord | { credential: string; openId4VcMetadata: OpenId4VcCredentialMetadata }>
  >

  protected constructor(
    options: ReceivePidUseCaseFlowOptions & ExtraOptions,
    resolvedAuthorizationRequest: OpenId4VciResolvedAuthorizationRequest,
    resolvedCredentialOffer: OpenId4VciResolvedCredentialOffer
  ) {
    this.resolvedAuthorizationRequest = resolvedAuthorizationRequest
    this.resolvedCredentialOffer = resolvedCredentialOffer
    this.options = options

    this.accessRights = new Promise((resolve) => {
      this.idCardAuthFlow = new AusweisAuthFlow({
        onEnterPin: async (options) => {
          const pin = await this.options.onEnterPin({
            ...options,
            currentSessionPinAttempts: this.currentSessionPinAttempts,
          })
          this.currentSessionPinAttempts += 1
          return pin
        },
        onError: (error) => {
          for (const errorCallback of this.errorCallbacks) {
            errorCallback(error)
          }
        },
        onSuccess: ({ refreshUrl }) => {
          for (const successCallback of this.successCallbacks) {
            successCallback({ refreshUrl })
          }
        },
        onCardAttachedChanged: (options) => this.options.onCardAttachedChanged?.(options),
        allowSimulatorCard: options.allowSimulatorCard,
        debug: __DEV__,
        onStatusProgress: (options) => this.options.onStatusProgress?.(options),
        onAttachCard: () => this.options.onAttachCard?.(),
        onRequestAccessRights: (options) => {
          resolve(options.effective)
          // FIXME: this is a bit hacky, we never resolve this one, as we manually call `ACCEPT_ACCESS_RIGHTS`
          return new Promise(() => {})
        },
      })
    })
  }

  public async cancelIdCardScanning() {
    if (this.currentState !== 'id-card-auth' || !this.idCardAuthFlow.isActive) {
      return
    }

    await this.idCardAuthFlow.cancel()
  }

  public authenticateUsingIdCard() {
    this.currentSessionPinAttempts = 0

    if (!this.idCardAuthFlow.isActive || !this.authenticationPromise) {
      throw new Error('authentication flow not active')
    }

    if (this.currentState !== 'id-card-auth') {
      throw new Error(`Current state is ${this.currentState}. Expected id-card-auth`)
    }

    sendCommand({ cmd: 'ACCEPT' })
    return this.authenticationPromise
  }

  public async acquireAccessToken() {
    this.assertState({ expectedState: 'acquire-access-token' })

    try {
      if (!this.refreshUrl) {
        throw new Error('Expected refreshUrl be defined in state acquire-access-token')
      }

      const authorizationCodeResponse = await fetch(this.refreshUrl)
      if (!authorizationCodeResponse.ok) {
        this.handleError('Did not receive valid response for authorization code redirect')
        return
      }

      const authorizationCode = new URL(authorizationCodeResponse.url).searchParams.get('code')

      if (!authorizationCode) {
        this.handleError('Missing authorization code')
        return
      }

      this.accessToken = await acquireAccessToken({
        resolvedCredentialOffer: this.resolvedCredentialOffer,
        resolvedAuthorizationRequest: {
          ...this.resolvedAuthorizationRequest,
          code: authorizationCode,
        },
        agent: this.options.agent,
      })

      this.assertState({
        expectedState: 'acquire-access-token',
        newState: 'retrieve-credential',
      })
    } catch (error) {
      this.handleError(error)
      throw error
    }
  }

  protected async startAuthFlow() {
    if (this.idCardAuthFlow.isActive) {
      throw new Error('authentication flow already active')
    }

    // We return an authentication promise to make it easier to track the state
    // We remove the callbacks once the error or success is triggered.
    const authenticationPromise = new Promise<void>((resolve, reject) => {
      const successCallback: AusweisAuthFlowOptions['onSuccess'] = () => {
        this.errorCallbacks = this.errorCallbacks.filter((c) => c === errorCallback)
        this.successCallbacks = this.successCallbacks.filter((c) => c === successCallback)
        resolve()
      }
      const errorCallback: AusweisAuthFlowOptions['onError'] = (error) => {
        this.errorCallbacks = this.errorCallbacks.filter((c) => c === errorCallback)
        this.successCallbacks = this.successCallbacks.filter((c) => c === successCallback)
        reject(error)
      }

      this.successCallbacks.push(successCallback)
      this.errorCallbacks.push(errorCallback)

      this.idCardAuthFlow.start({
        tcTokenUrl: this.resolvedAuthorizationRequest.authorizationRequestUri,
      })
    })

    this.authenticationPromise = authenticationPromise
    return authenticationPromise
  }

  protected assertState({
    expectedState,
    newState,
  }: {
    expectedState: ReceivePidUseCaseState
    newState?: ReceivePidUseCaseState
  }) {
    if (this.currentState !== expectedState) {
      throw new Error(`Expected state to be ${expectedState}. Found ${this.currentState}`)
    }

    if (newState) {
      this.currentState = newState
      this.options.onStateChange?.(newState)
    }
  }

  protected handleError(error: unknown) {
    this.currentState = 'error'
    console.error(error)
    this.options.onStateChange?.('error')
  }
}
