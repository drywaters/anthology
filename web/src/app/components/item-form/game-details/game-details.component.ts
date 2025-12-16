import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

@Component({
    selector: 'app-game-details',
    standalone: true,
    imports: [CommonModule, MatFormFieldModule, MatInputModule, ReactiveFormsModule],
    templateUrl: './game-details.component.html',
    styleUrl: './game-details.component.scss',
})
export class GameDetailsComponent {
    @Input({ required: true }) form!: FormGroup;
}
