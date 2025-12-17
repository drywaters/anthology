import {
    ChangeDetectionStrategy,
    Component,
    EventEmitter,
    Output,
    computed,
    inject,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { ThemeService } from '../../services/theme.service';

@Component({
    selector: 'app-header',
    standalone: true,
    imports: [MatIconModule, MatButtonModule],
    templateUrl: './app-header.component.html',
    styleUrl: './app-header.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppHeaderComponent {
    @Output() readonly menuToggle = new EventEmitter<void>();

    private readonly themeService = inject(ThemeService);

    readonly isDarkTheme = computed(() => this.themeService.effectiveTheme() === 'dark');
    readonly themeToggleIcon = computed(() => (this.isDarkTheme() ? 'light_mode' : 'dark_mode'));

    toggleTheme(): void {
        this.themeService.toggle();
    }
}
