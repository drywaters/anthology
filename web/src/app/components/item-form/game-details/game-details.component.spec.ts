import { TestBed } from '@angular/core/testing';
import { FormBuilder, FormGroup } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { GameDetailsComponent } from './game-details.component';

describe(GameDetailsComponent.name, () => {
    let form: FormGroup;

    beforeEach(async () => {
        const fb = new FormBuilder();
        form = fb.group({
            platform: [''],
            ageGroup: [''],
            playerCount: [''],
            description: [''],
        });

        await TestBed.configureTestingModule({
            imports: [GameDetailsComponent, NoopAnimationsModule],
        }).compileComponents();
    });

    function createComponent() {
        const fixture = TestBed.createComponent(GameDetailsComponent);
        fixture.componentInstance.form = form;
        fixture.detectChanges();
        return fixture;
    }

    it('creates the component', () => {
        const fixture = createComponent();
        expect(fixture.componentInstance).toBeTruthy();
    });

    it('binds to the form group provided', () => {
        const fixture = createComponent();
        form.patchValue({ platform: 'Nintendo Switch' });

        expect(fixture.componentInstance.form.get('platform')?.value).toBe('Nintendo Switch');
    });
});
