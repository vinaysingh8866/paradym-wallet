import {
  AnonCredsCredentialFormatService,
  AnonCredsModule,
  AnonCredsProofFormatService,
  LegacyIndyCredentialFormatService,
  LegacyIndyProofFormatService,
  V1CredentialProtocol,
  V1ProofProtocol,
} from '@credo-ts/anoncreds'
import { AskarModule } from '@credo-ts/askar'

import {
  Agent,
  AutoAcceptCredential,
  AutoAcceptProof,
  ConnectionsModule,
  CredentialsModule,
  DidsModule,
  HttpOutboundTransport,
  JwkDidRegistrar,
  JwkDidResolver,
  KeyDerivationMethod,
  KeyDidRegistrar,
  KeyDidResolver,
  LogLevel,
  MediationRecipientModule,
  MediatorPickupStrategy,
  ProofsModule,
  V2CredentialProtocol,
  V2ProofProtocol,
  WebDidResolver,
  WsOutboundTransport,
  X509Module,
} from '@credo-ts/core'
import {
  IndyVdrAnonCredsRegistry,
  IndyVdrIndyDidResolver,
  IndyVdrModule,
  IndyVdrSovDidResolver,
} from '@credo-ts/indy-vdr'
import { OpenId4VcHolderModule } from '@credo-ts/openid4vc'
import { useAgent as useAgentLib } from '@credo-ts/react-hooks'
import { agentDependencies } from '@credo-ts/react-native'
import { anoncreds } from '@hyperledger/anoncreds-react-native'
import { ariesAskar } from '@hyperledger/aries-askar-react-native'
import { indyVdr } from '@hyperledger/indy-vdr-react-native'
import { DidWebAnonCredsRegistry } from 'credo-ts-didweb-anoncreds'

import { indyNetworks } from './indyNetworks'
import { appLogger } from './logger'

const askarModule = new AskarModule({
  ariesAskar: ariesAskar,
})

export const initializeEasyPIDAgent = async ({
  walletLabel,
  walletId,
  walletKey,
  keyDerivation,
  trustedX509Certificates,
}: {
  walletLabel: string
  walletId: string
  walletKey: string
  keyDerivation: 'raw' | 'derive'
  trustedX509Certificates: string[]
}) => {
  const agent = new Agent({
    dependencies: agentDependencies,
    config: {
      label: walletLabel,
      walletConfig: {
        id: walletId,
        key: walletKey,
        keyDerivationMethod: keyDerivation === 'raw' ? KeyDerivationMethod.Raw : KeyDerivationMethod.Argon2IMod,
      },
      autoUpdateStorageOnStartup: true,
      logger: appLogger(LogLevel.debug),
      
    },
    modules: {
      ariesAskar: askarModule,
      openId4VcHolder: new OpenId4VcHolderModule(),
      
    },
  })

  await agent.initialize()

  // Register the trusted x509 certificates
  for (const trustedCertificate of trustedX509Certificates) {
    agent.x509.addTrustedCertificate(trustedCertificate)
  }

  return agent
}

export const initializeFullAgent = async ({
  walletLabel,
  walletId,
  walletKey,
  keyDerivation,
}: {
  walletLabel: string
  walletId: string
  walletKey: string
  keyDerivation: 'raw' | 'derive'
}) => {
  // FIXME: in the easypid app importing the cheqd module gives errors. As we're not using cheqd in the EasyPid wallet
  // we protect it like this, but I think the Paradym Wallet must be broken as well then?!?
  const { CheqdAnonCredsRegistry, CheqdDidResolver, CheqdModule, CheqdModuleConfig } =
    require('@credo-ts/cheqd') as typeof import('@credo-ts/cheqd')

  const agent = new Agent({
    dependencies: agentDependencies,
    config: {
      label: walletLabel,
      walletConfig: {
        id: walletId,
        key: walletKey,
        keyDerivationMethod: keyDerivation === 'raw' ? KeyDerivationMethod.Raw : KeyDerivationMethod.Argon2IMod,
      },
      autoUpdateStorageOnStartup: true,
      logger: appLogger(LogLevel.debug),
    },
    modules: {
      ariesAskar: askarModule,
      openId4VcHolder: new OpenId4VcHolderModule(),
      dids: new DidsModule({
        registrars: [new KeyDidRegistrar(), new JwkDidRegistrar()],
        resolvers: [
          new WebDidResolver(),
          new KeyDidResolver(),
          new JwkDidResolver(),
          new CheqdDidResolver(),
          new IndyVdrSovDidResolver(),
          new IndyVdrIndyDidResolver(),
        ],
      }),
      anoncreds: new AnonCredsModule({
        registries: [new IndyVdrAnonCredsRegistry(), new CheqdAnonCredsRegistry(), new DidWebAnonCredsRegistry()],
        anoncreds,
      }),

      mediationRecipient: new MediationRecipientModule({
        mediatorInvitationUrl:"https://us-east2.public.mediator.indiciotech.io/message?oob=eyJAaWQiOiIyNzFmYTZiYS0xYmUxLTQ0ZDEtYjZlZi01ZmM2ODcyZTY4NmYiLCJAdHlwZSI6Imh0dHBzOi8vZGlkY29tbS5vcmcvb3V0LW9mLWJhbmQvMS4xL2ludml0YXRpb24iLCJoYW5kc2hha2VfcHJvdG9jb2xzIjpbImh0dHBzOi8vZGlkY29tbS5vcmcvZGlkZXhjaGFuZ2UvMS4wIl0sImFjY2VwdCI6WyJkaWRjb21tL2FpcDEiLCJkaWRjb21tL2FpcDI7ZW52PXJmYzE5Il0sImxhYmVsIjoiQ2xvdWQgTWVkaWF0b3IiLCJzZXJ2aWNlcyI6W3siaWQiOiIjaW5saW5lIiwidHlwZSI6ImRpZC1jb21tdW5pY2F0aW9uIiwicmVjaXBpZW50S2V5cyI6WyJkaWQ6a2V5Ono2TWtnczZNd1lCM1lnVG9aWEd3a25xQzM1MmNiSHR4SnNpM3pYWmZGMXQyZk5rVCN6Nk1rZ3M2TXdZQjNZZ1RvWlhHd2tucUMzNTJjYkh0eEpzaTN6WFpmRjF0MmZOa1QiXSwic2VydmljZUVuZHBvaW50IjoiaHR0cHM6Ly91cy1lYXN0Mi5wdWJsaWMubWVkaWF0b3IuaW5kaWNpb3RlY2guaW8vbWVzc2FnZSJ9LHsiaWQiOiIjaW5saW5lIiwidHlwZSI6ImRpZC1jb21tdW5pY2F0aW9uIiwicmVjaXBpZW50S2V5cyI6WyJkaWQ6a2V5Ono2TWtnczZNd1lCM1lnVG9aWEd3a25xQzM1MmNiSHR4SnNpM3pYWmZGMXQyZk5rVCN6Nk1rZ3M2TXdZQjNZZ1RvWlhHd2tucUMzNTJjYkh0eEpzaTN6WFpmRjF0MmZOa1QiXSwic2VydmljZUVuZHBvaW50Ijoid3NzOi8vd3MudXMtZWFzdDIucHVibGljLm1lZGlhdG9yLmluZGljaW90ZWNoLmlvL3dzIn1dfQ=="
      }),

      indyVdr: new IndyVdrModule({
        indyVdr,
        networks: indyNetworks,
      }),
      connections: new ConnectionsModule({
        autoAcceptConnections: true,
      }),
      cheqd: new CheqdModule(
        new CheqdModuleConfig({
          networks: [
            {
              network: 'testnet',
            },
            {
              network: 'mainnet',
            },
          ],
        })
      ),
      credentials: new CredentialsModule({
        autoAcceptCredentials: AutoAcceptCredential.ContentApproved,
        credentialProtocols: [
          new V1CredentialProtocol({
            indyCredentialFormat: new LegacyIndyCredentialFormatService(),
          }),
          new V2CredentialProtocol({
            credentialFormats: [new LegacyIndyCredentialFormatService(), new AnonCredsCredentialFormatService()],
          }),
        ],
      }),
      proofs: new ProofsModule({
        autoAcceptProofs: AutoAcceptProof.ContentApproved,
        proofProtocols: [
          new V1ProofProtocol({
            indyProofFormat: new LegacyIndyProofFormatService(),
          }),
          new V2ProofProtocol({
            proofFormats: [new LegacyIndyProofFormatService(), new AnonCredsProofFormatService()],
          }),
        ],
      }),
    },
  })

  agent.registerOutboundTransport(new HttpOutboundTransport())
  agent.registerOutboundTransport(new WsOutboundTransport())

  await agent.initialize()

  return agent
}

export type FullAppAgent = Awaited<ReturnType<typeof initializeFullAgent>>
export type EasyPIDAppAgent = Awaited<ReturnType<typeof initializeEasyPIDAgent>>
export type EitherAgent = FullAppAgent | EasyPIDAppAgent

// biome-ignore lint/suspicious/noExplicitAny: it just needs to extend any, it won't actually be used
export const useAgent = <A extends Agent<any> = FullAppAgent>(): {
  agent: A
  loading: boolean
} => {
  const { agent, loading } = useAgentLib<A>()

  if (!agent) {
    throw new Error('useAgent should only be used inside AgentProvider with a valid agent.')
  }

  return { agent, loading }
}
