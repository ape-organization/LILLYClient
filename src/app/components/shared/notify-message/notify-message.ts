import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MaterialModule } from '../../../shared/AngularMaterial';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-notify-message',
  imports: [CommonModule,  MaterialModule,TranslatePipe],
  templateUrl: './notify-message.html',
  styleUrl: './notify-message.scss',
})
export class NotifyMessage {
 constructor(
    public dialogRef: MatDialogRef<NotifyMessage>,
    @Inject(MAT_DIALOG_DATA) public data: { title: string; icon:string;message: string }
  ) {}

  onConfirm(): void {
    this.dialogRef.close(true);
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }
}
