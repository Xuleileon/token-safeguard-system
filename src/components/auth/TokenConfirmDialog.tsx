import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface TokenConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expiresAt: string | null;
  onConfirm: () => void;
}

export default function TokenConfirmDialog({ 
  open, 
  onOpenChange, 
  expiresAt, 
  onConfirm 
}: TokenConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Token Still Valid</DialogTitle>
          <DialogDescription>
            This App ID already has a valid token that expires at {expiresAt ? new Date(expiresAt).toLocaleString() : 'Unknown'}. 
            Do you want to proceed with re-authorization?
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onConfirm}>
            Continue
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}