import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

import { SubpanelComponent } from './subpanel.component';

describe(SubpanelComponent.name, () => {
  let fixture: ComponentFixture<SubpanelComponent>;
  let component: SubpanelComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SubpanelComponent],
      providers: [provideNoopAnimations()],
    }).compileComponents();

    fixture = TestBed.createComponent(SubpanelComponent);
    component = fixture.componentInstance;
    component.section = 'library';
    component.actions = [
      { id: 'add-item', label: 'Add Item' },
      { id: 'import', label: 'Import', icon: 'cloud_upload' },
    ];
    fixture.detectChanges();
  });

  it('renders the section title and actions', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.title')?.textContent?.trim()).toBe('Library');
    expect(compiled.querySelectorAll('.action-pill').length).toBe(component.actions.length);
  });

  it('emits a back event when the back button is pressed', () => {
    spyOn(component.back, 'emit');
    const button = fixture.nativeElement.querySelector('.back-button') as HTMLButtonElement;
    button.click();
    expect(component.back.emit).toHaveBeenCalled();
  });

  it('emits an actionTriggered event for the clicked action', () => {
    spyOn(component.actionTriggered, 'emit');
    const actionButtons = fixture.nativeElement.querySelectorAll('.action-pill');
    (actionButtons[1] as HTMLButtonElement).click();
    expect(component.actionTriggered.emit).toHaveBeenCalledWith('import');
  });
});
