"use client";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { RobotConnection } from "@/types/robot";

interface EditRobotDialogProps {
  robot: RobotConnection | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (updatedRobot: RobotConnection) => void;
}

export function EditRobotDialog({
  robot,
  isOpen,
  onOpenChange,
  onSave,
}: EditRobotDialogProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState<"so100_follower" | "so100_leader">(
    "so100_follower"
  );

  useEffect(() => {
    if (robot) {
      setName(robot.name);
      setType(robot.robotType || "so100_follower");
    }
  }, [robot]);

  const handleSave = () => {
    if (robot) {
      onSave({ ...robot, name, robotId: name, robotType: type });
    }
  };

  if (!robot) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="font-sans bg-background/80 backdrop-blur-sm border-primary/20">
        <DialogHeader>
          <DialogTitle>Configure Robot</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Name
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="col-span-3 font-mono"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Type</Label>
            <RadioGroup
              value={type}
              onValueChange={(value) =>
                setType(value as "so100_follower" | "so100_leader")
              }
              className="col-span-3"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="so100_follower" id="r1" />
                <Label htmlFor="r1">SO-100 Follower</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="so100_leader" id="r2" />
                <Label htmlFor="r2">SO-100 Leader</Label>
              </div>
            </RadioGroup>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              Cancel
            </Button>
          </DialogClose>
          <DialogClose asChild>
            <Button type="submit" onClick={handleSave}>
              Save Changes
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
