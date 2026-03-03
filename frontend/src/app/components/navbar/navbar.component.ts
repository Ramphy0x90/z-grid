import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import {
	DEFAULT_PROJECT_PAGE,
	PAGE_GROUPS,
	toProjectPageCommands,
	toProjectsCommands,
} from '../../app.routes';
import { NavigationActions } from '../../stores/navigation/navigation.actions';
import { NavigationSelectors } from '../../stores/navigation/navigation.selectors';
import { ProjectSelectors } from '../../stores/project/project.selectors';

@Component({
	selector: 'app-navbar',
	templateUrl: './navbar.component.html',
	styleUrl: './navbar.component.css',
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		'(document:click)': 'onDocumentClick($event)',
	},
})
export class NavbarComponent {
	private readonly store = inject(Store);
	private readonly router = inject(Router);
	private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

	protected readonly projects = this.store.selectSignal(ProjectSelectors.projects);
	protected readonly selectedProjectId = this.store.selectSignal(
		ProjectSelectors.selectedProjectId,
	);
	protected readonly selectedPageId = this.store.selectSignal(NavigationSelectors.selectedPageId);
	protected readonly hasProjectSelected = this.store.selectSignal(
		ProjectSelectors.hasProjectSelected,
	);
	protected readonly collapsed = this.store.selectSignal(NavigationSelectors.collapsed);
	protected readonly pageGroups = PAGE_GROUPS;

	protected readonly expandedGroups = signal<Record<string, boolean>>({
		project: false,
		grid: false,
		'static-calculation': false,
	});

	protected readonly floatingGroupId = signal<string | null>(null);
	protected readonly activeGroupByPage = computed(() => {
		const pageId = this.selectedPageId();
		if (!pageId) {
			return null;
		}
		return (
			this.pageGroups.find((group) => group.children.some((child) => child.id === pageId))?.id ??
			null
		);
	});
	protected onProjectSelect(projectId: string): void {
		if (!projectId) {
			this.onClearSelection();
			return;
		}
		const selectedPageId = this.selectedPageId() ?? DEFAULT_PROJECT_PAGE;
		this.router.navigate([...toProjectPageCommands(projectId, selectedPageId)]);
		this.floatingGroupId.set(null);
	}

	protected onPageClick(pageId: string): void {
		const projectId = this.selectedProjectId();
		if (!projectId) {
			return;
		}
		this.router.navigate([...toProjectPageCommands(projectId, pageId)]);
		this.floatingGroupId.set(null);
	}

	protected onClearSelection(): void {
		this.router.navigate([...toProjectsCommands()]);
		this.floatingGroupId.set(null);
	}

	protected toggleCollapsed(): void {
		this.store.dispatch(NavigationActions.navbarToggled());
		this.floatingGroupId.set(null);
	}

	protected toggleGroup(groupId: string): void {
		this.expandedGroups.update((state) => ({
			...state,
			[groupId]: !state[groupId],
		}));
	}

	protected toggleFloatingGroup(groupId: string): void {
		this.floatingGroupId.update((current) => (current === groupId ? null : groupId));
	}

	protected onDocumentClick(event: MouseEvent): void {
		const target = event.target;
		if (!(target instanceof Node)) {
			return;
		}

		if (!this.elementRef.nativeElement.contains(target)) {
			this.floatingGroupId.set(null);
		}
	}

	protected isGroupExpanded(groupId: string): boolean {
		return this.expandedGroups()[groupId] ?? false;
	}
}
