import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";

interface CalibrationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deviceType: string;
  onContinue: () => void;
}

export function CalibrationModal({
  open,
  onOpenChange,
  deviceType,
  onContinue,
}: CalibrationModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>📍 Set Homing Position</DialogTitle>
          <DialogDescription className="text-base py-4">
            Move the SO-100 {deviceType} to the <strong>MIDDLE</strong> of its
            range of motion and click OK when ready.
            <br />
            <br />
            The calibration will then automatically:
            <br />• Record homing offsets
            <br />• Record joint ranges (manual - you control when to stop)
            <br />• Save configuration file
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button onClick={onContinue} className="w-full">
            OK - Start Calibration
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
