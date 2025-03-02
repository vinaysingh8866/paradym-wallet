import { Heading, LucideIcons, Paragraph, TableContainer, TableRow, XStack, YStack } from '@package/ui'

import { formatCredentialSubject } from '../utils'

type CredentialAttributesProps = {
  subject: Record<string, unknown>
  disableHeader?: boolean
  headerTitle?: string
  headerStyle?: 'regular' | 'small'
}

export function CredentialAttributes({
  subject,
  disableHeader = false,
  headerTitle,
  headerStyle = 'regular',
}: CredentialAttributesProps) {
  const tables = formatCredentialSubject(subject)

  return (
    <YStack g="md">
      {tables.map((table, index) => (
        <YStack key={`${table.parent}-${table.depth}-${table.title}-${index}`} g="md" pt={table.parent ? 0 : '$2'}>
          <XStack gap="$2">
            {table.depth > 1 && <LucideIcons.CornerDownRight size="$1" />}
            {(!disableHeader || table.title) && (
              <Heading
                variant={headerStyle === 'small' ? 'h4' : 'h3'}
                pl={headerStyle === 'regular' && '$2'}
                fontWeight={headerStyle === 'small' ? '$semiBold' : '$medium'}
                secondary
              >
                {table.title ?? headerTitle ?? 'Credential information'}
              </Heading>
            )}
            {table.parent && (
              <Paragraph mt="$1" variant="sub" secondary>
                part of {table.parent}
              </Paragraph>
            )}
          </XStack>

          <TableContainer>
            {table.rows.map((row, idx) => (
              // TODO: We should create a bottom sheet overlay to show the full attribute and value
              // as now it's sometimes cut off because the attribute value is too long for the view.
              // however, we can't overlay a Tamagui Sheet over a modal screen
              // so we probably need a custom implementation for this.
              <TableRow
                key={row.key ?? (row.type === 'imageAndString' || row.type === 'string' ? row.value : row.image)}
                attribute={row.key}
                value={row.type === 'string' || row.type === 'imageAndString' ? row.value : undefined}
                isLastRow={idx === table.rows.length - 1}
                image={row.type === 'image' || row.type === 'imageAndString' ? row.image : undefined}
              />
            ))}
          </TableContainer>
        </YStack>
      ))}
    </YStack>
  )
}
