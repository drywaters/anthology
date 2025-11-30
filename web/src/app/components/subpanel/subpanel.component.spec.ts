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
    component.links = [
      { id: 'library-home', label: 'All Items', icon: 'collections_bookmark', route: '/' },
      { id: 'add-item', label: 'Add Item', icon: 'library_add', route: '/items/add' },
    ];
    fixture.detectChanges();
  });

  it('renders the section title, links, and actions', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.title')?.textContent?.trim()).toBe('Library');
    expect(compiled.querySelectorAll('.link-tile').length).toBe(component.links.length);
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

  it('emits linkSelected when a link is clicked', () => {
    spyOn(component.linkSelected, 'emit');
    const linkButtons = fixture.nativeElement.querySelectorAll('.link-tile');
    (linkButtons[0] as HTMLButtonElement).click();
    expect(component.linkSelected.emit).toHaveBeenCalledWith(component.links[0]);
  });
});
