import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { Store } from '@ngrx/store';
import { NavbarComponent } from './components/navbar/navbar.component';
import { NavigationActions } from './stores/navigation/navigation.actions';
import { NavigationSelectors } from './stores/navigation/navigation.selectors';
import { ProjectActions } from './stores/project/project.actions';
import { ProjectService } from './services/project.service';
import { ROUTES } from './app.routes';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NavbarComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly router = inject(Router);
  private readonly store = inject(Store);
  private readonly projectService = inject(ProjectService);
  protected readonly topbarTitle = this.store.selectSignal(NavigationSelectors.topbarTitle);

  constructor() {
    this.store.dispatch(
      ProjectActions.projectsLoaded({ projects: this.projectService.projects() }),
    );

    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe(() => {
      this.syncRoute();
    });

    this.syncRoute();
  }

  private syncRoute(): void {
    const urlTree = this.router.parseUrl(this.router.url);
    const segments =
      urlTree.root.children['primary']?.segments.map((segment) => segment.path) ?? [];
    const [firstSegment, secondSegment] = segments;
    const projectId = !firstSegment || firstSegment === ROUTES.PROJECTS ? null : firstSegment;
    const pageId = secondSegment ?? null;

    this.store.dispatch(ProjectActions.selectedProjectSynced({ projectId }));
    this.store.dispatch(NavigationActions.routeSynced({ pageId }));
  }
}
