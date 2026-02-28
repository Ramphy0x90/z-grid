import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { DEFAULT_PROJECT_PAGE, toProjectPageCommands } from '../../app.routes';
import { ProjectSelectors } from '../../stores/project/project.selectors';

@Component({
  selector: 'app-projects-page',
  templateUrl: './projects-page.component.html',
  styleUrl: './projects-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectsPageComponent {
  private readonly router = inject(Router);
  private readonly store = inject(Store);
  protected readonly projects = this.store.selectSignal(ProjectSelectors.projects);

  protected selectProject(projectId: string): void {
    this.router.navigate([...toProjectPageCommands(projectId, DEFAULT_PROJECT_PAGE)]);
  }
}
