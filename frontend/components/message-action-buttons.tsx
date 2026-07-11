import type { MessageArtifactButton } from "@/lib/types";

export type MessageActionButton = MessageArtifactButton;

type MessageActionButtonsProps = {
  buttons: MessageActionButton[];
  onSelect: (button: MessageActionButton) => void;
  ariaLabel?: string;
};

export function MessageActionButtons({ buttons, onSelect, ariaLabel = "Message actions" }: MessageActionButtonsProps) {
  return (
    <div className="ios-message-buttons" role="group" aria-label={ariaLabel}>
      {buttons.map((button) => {
        const variantClass = button.variant ? ` ios-message-button-${button.variant}` : "";

        return (
          <button
            type="button"
            id={button.id}
            className={variantClass.trim() || undefined}
            key={button.id}
            onClick={() => onSelect(button)}
          >
            {button.content}
          </button>
        );
      })}
    </div>
  );
}

type DestructiveConfirmationButtonsProps = {
  destructiveAction: MessageActionButton;
  safeAction: MessageActionButton;
  onSelect: (button: MessageActionButton) => void;
};

export function DestructiveConfirmationButtons({
  destructiveAction,
  safeAction,
  onSelect,
}: DestructiveConfirmationButtonsProps) {
  return (
    <MessageActionButtons
      ariaLabel="Confirm action"
      buttons={[
        { ...destructiveAction, variant: "destructive" },
        { ...safeAction, variant: "green" },
      ]}
      onSelect={onSelect}
    />
  );
}
