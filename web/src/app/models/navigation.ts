export interface NavigationItem {
    id: string;
    label: string;
    icon?: string;
    route: string;
    actions?: ActionButton[];
}

export interface ActionButton {
    id: string;
    label: string;
    icon?: string;
    route?: string;
}
