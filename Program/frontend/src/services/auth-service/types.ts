export type RoleResponseDTO = {
    id: string | null;
    name: string;
    permissions: string[];
};

export type CreateRoleRequestDTO = {
    name: string;
    permissions: string[];
};
