import { Sheet as TamaguiSheet, type SheetProps as TamaguiSheetProps } from 'tamagui'

interface SheetProps extends TamaguiSheetProps {
  isOpen: boolean
  setIsOpen: (open: boolean) => void
}

export function Sheet({ children, isOpen, setIsOpen, ...props }: SheetProps) {
  return (
    <TamaguiSheet
      dismissOnOverlayPress
      onOpenChange={setIsOpen}
      open={isOpen}
      snapPointsMode="fit"
      dismissOnSnapToBottom
      animationConfig={{
        type: 'spring',
        stiffness: 180,
        damping: 24,
        mass: 0.2,
      }}
      {...props}
    >
      <TamaguiSheet.Overlay
        style={{
          backgroundColor: '#00000033',
        }}
        animation="quick"
        enterStyle={{ opacity: 0 }}
        exitStyle={{ opacity: 0 }}
      />
      <TamaguiSheet.Frame>{children}</TamaguiSheet.Frame>
    </TamaguiSheet>
  )
}
