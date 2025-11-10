import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  templateUrl: './login-page.component.html',
  styleUrl: './login-page.component.scss',
})
export class LoginPageComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly formBuilder = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly form = this.formBuilder.group({
    token: ['', [Validators.required]],
  });
  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  get tokenControl() {
    return this.form.controls.token;
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const token = this.tokenControl.value?.trim();
    if (!token) {
      this.tokenControl.setErrors({ required: true });
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);

    this.authService
      .login(token)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.submitting.set(false);
          const redirectTo = this.route.snapshot.queryParamMap.get('redirectTo');
          this.router.navigateByUrl(redirectTo || '/');
        },
        error: (error) => {
          this.submitting.set(false);
          if (error.status === 401) {
            this.errorMessage.set('Invalid token. Double-check the API_TOKEN value.');
            this.tokenControl.setErrors({ invalid: true });
          } else {
            this.errorMessage.set('Unable to establish a session right now.');
          }
        },
      });
  }

  clearSession(): void {
    this.submitting.set(true);
    this.errorMessage.set(null);
    this.authService
      .logout()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.form.reset({ token: '' });
        },
        error: () => {
          this.submitting.set(false);
          this.errorMessage.set('We could not clear your session.');
        },
      });
  }
}
