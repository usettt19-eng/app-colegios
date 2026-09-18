import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Shield, Users2, Lock, CheckCircle2, X, Loader2 } from 'lucide-react';

const DEMO_TENANT_ID = '11111111-1111-1111-1111-111111111111';

interface Role {
  id: string;
  name: string;
  description?: string;
  is_built_in: boolean;
  created_at: string;
}

interface PortalSection {
  id: string;
  portal_id: string;
  section_id: string;
  display_name: string;
  description?: string;
}

interface Permission {
  id: string;
  permission_id: string;
  display_name: string;
  description?: string;
  section_id: string;
}

interface RolePermission {
  id: string;
  permission_id: string;
  display_name: string;
  section?: PortalSection;
}

interface ProfileRoleAssignment {
  id: string;
  profile_id: string;
  role_id: string;
  department_id?: string;
  roles?: Role;
  departments?: { name: string };
}

interface StaffProfile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

export const RBACManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'roles' | 'assignments'>('roles');
  const [roles, setRoles] = useState<Role[]>([]);
  const [portalSections, setPortalSections] = useState<PortalSection[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
  const [showNewRoleModal, setShowNewRoleModal] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');
  const [staffProfiles, setStaffProfiles] = useState<StaffProfile[]>([]);
  const [assignments, setAssignments] = useState<ProfileRoleAssignment[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<StaffProfile | null>(null);
  const [staffRoles, setStaffRoles] = useState<ProfileRoleAssignment[]>([]);

  // Fetch data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [rolesRes, sectionsRes, staffRes] = await Promise.all([
          fetch(`/api/v1/rbac/roles?tenant_id=${DEMO_TENANT_ID}`),
          fetch('/api/v1/rbac/portal-sections'),
          fetch(`/api/v1/hierarchy/staff?tenant_id=${DEMO_TENANT_ID}`)
        ]);

        if (rolesRes.ok) {
          const data = await rolesRes.json();
          setRoles(data.roles || []);
        }

        if (sectionsRes.ok) {
          const data = await sectionsRes.json();
          setPortalSections(data.sections || []);
          // Load permissions for each section
          for (const section of data.sections || []) {
            const permRes = await fetch(`/api/v1/rbac/permissions/${section.id}`);
            if (permRes.ok) {
              const permData = await permRes.json();
              setPermissions(prev => [...prev, ...(permData.permissions || [])]);
            }
          }
        }

        if (staffRes.ok) {
          const data = await staffRes.json();
          setStaffProfiles(data.staff || []);
        }
      } catch (err) {
        setError('Error al cargar datos de RBAC');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Load role permissions
  useEffect(() => {
    if (selectedRole) {
      const loadRolePermissions = async () => {
        try {
          const res = await fetch(`/api/v1/rbac/roles/${selectedRole.id}/permissions`);
          if (res.ok) {
            const data = await res.json();
            setRolePermissions(data.permissions || []);
          }
        } catch (err) {
          console.error('Error loading role permissions:', err);
        }
      };
      loadRolePermissions();
    }
  }, [selectedRole]);

  // Load staff roles
  useEffect(() => {
    if (selectedStaff) {
      const loadStaffRoles = async () => {
        try {
          const res = await fetch(`/api/v1/rbac/profile/${selectedStaff.id}/roles?tenant_id=${DEMO_TENANT_ID}`);
          if (res.ok) {
            const data = await res.json();
            setStaffRoles(data.assignments || []);
          }
        } catch (err) {
          console.error('Error loading staff roles:', err);
        }
      };
      loadStaffRoles();
    }
  }, [selectedStaff]);

  const handleCreateRole = async () => {
    if (!newRoleName.trim()) return;

    try {
      const res = await fetch('/api/v1/rbac/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: DEMO_TENANT_ID,
          name: newRoleName,
          description: newRoleDesc
        })
      });

      if (res.ok) {
        const data = await res.json();
        setRoles([...roles, data.role]);
        setNewRoleName('');
        setNewRoleDesc('');
        setShowNewRoleModal(false);
      } else {
        setError('Error al crear rol');
      }
    } catch (err) {
      setError('Error al crear rol');
      console.error(err);
    }
  };

  const handleAddPermissionToRole = async (permissionId: string) => {
    if (!selectedRole) return;

    try {
      const res = await fetch(`/api/v1/rbac/roles/${selectedRole.id}/permissions/${permissionId}`, {
        method: 'POST'
      });

      if (res.ok) {
        // Reload permissions
        const permRes = await fetch(`/api/v1/rbac/roles/${selectedRole.id}/permissions`);
        if (permRes.ok) {
          const data = await permRes.json();
          setRolePermissions(data.permissions || []);
        }
      } else {
        setError('Error al asignar permiso');
      }
    } catch (err) {
      setError('Error al asignar permiso');
      console.error(err);
    }
  };

  const handleRemovePermissionFromRole = async (permissionId: string) => {
    if (!selectedRole) return;

    try {
      const res = await fetch(`/api/v1/rbac/roles/${selectedRole.id}/permissions/${permissionId}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        setRolePermissions(rolePermissions.filter(p => p.id !== permissionId));
      } else {
        setError('Error al remover permiso');
      }
    } catch (err) {
      setError('Error al remover permiso');
      console.error(err);
    }
  };

  const handleAssignRoleToStaff = async (roleId: string) => {
    if (!selectedStaff) return;

    try {
      const res = await fetch('/api/v1/rbac/assign-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: DEMO_TENANT_ID,
          profile_id: selectedStaff.id,
          role_id: roleId
        })
      });

      if (res.ok) {
        // Reload staff roles
        const rolesRes = await fetch(`/api/v1/rbac/profile/${selectedStaff.id}/roles?tenant_id=${DEMO_TENANT_ID}`);
        if (rolesRes.ok) {
          const data = await rolesRes.json();
          setStaffRoles(data.assignments || []);
        }
      } else {
        setError('Error al asignar rol');
      }
    } catch (err) {
      setError('Error al asignar rol');
      console.error(err);
    }
  };

  const handleRemoveRoleFromStaff = async (assignmentId: string) => {
    try {
      const res = await fetch(`/api/v1/rbac/assign-role/${assignmentId}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        setStaffRoles(staffRoles.filter(a => a.id !== assignmentId));
      } else {
        setError('Error al remover rol');
      }
    } catch (err) {
      setError('Error al remover rol');
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-between">
          <span className="text-red-800">{error}</span>
          <button onClick={() => setError('')} className="text-red-500 hover:text-red-700">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('roles')}
          className={`px-4 py-2 font-medium border-b-2 transition ${
            activeTab === 'roles'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-600 hover:text-gray-800'
          }`}
        >
          <Shield className="w-4 h-4 inline mr-2" />
          Gestión de Roles
        </button>
        <button
          onClick={() => setActiveTab('assignments')}
          className={`px-4 py-2 font-medium border-b-2 transition ${
            activeTab === 'assignments'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-600 hover:text-gray-800'
          }`}
        >
          <Users2 className="w-4 h-4 inline mr-2" />
          Asignación a Staff
        </button>
      </div>

      {/* Roles Tab */}
      {activeTab === 'roles' && (
        <div className="grid grid-cols-2 gap-6">
          {/* Roles List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Roles Disponibles</h3>
              <button
                onClick={() => setShowNewRoleModal(true)}
                className="flex items-center gap-2 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
              >
                <Plus className="w-4 h-4" />
                Nuevo Rol
              </button>
            </div>

            <div className="space-y-2">
              {roles.map(role => (
                <button
                  key={role.id}
                  onClick={() => setSelectedRole(role)}
                  className={`w-full text-left px-4 py-2 rounded border-2 transition ${
                    selectedRole?.id === role.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-medium text-gray-900">{role.name}</div>
                  <div className="text-sm text-gray-600">{role.description || 'Sin descripción'}</div>
                  {role.is_built_in && (
                    <div className="text-xs text-blue-600 font-medium">Rol del sistema</div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Permissions Management */}
          <div className="space-y-4">
            {selectedRole ? (
              <>
                <h3 className="text-lg font-semibold text-gray-900">
                  Permisos: {selectedRole.name}
                </h3>

                {/* Grouped by Portal */}
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {Array.from(new Set(portalSections.map(s => s.portal_id))).map(portal => (
                    <div key={portal} className="bg-gray-50 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 mb-3 capitalize">{portal}</h4>
                      <div className="space-y-2">
                        {portalSections
                          .filter(s => s.portal_id === portal)
                          .map(section => {
                            const sectionPerms = permissions.filter(p => p.section_id === section.id);
                            const assigned = rolePermissions.filter(rp => rp.section === section);
                            return (
                              <div key={section.id} className="text-sm">
                                <div className="font-medium text-gray-800 mb-1">{section.display_name}</div>
                                <div className="flex flex-wrap gap-1">
                                  {sectionPerms.map(perm => {
                                    const isAssigned = rolePermissions.some(rp => rp.id === perm.id);
                                    return (
                                      <button
                                        key={perm.id}
                                        onClick={() =>
                                          isAssigned
                                            ? handleRemovePermissionFromRole(perm.id)
                                            : handleAddPermissionToRole(perm.id)
                                        }
                                        className={`px-2 py-1 rounded text-xs font-medium transition ${
                                          isAssigned
                                            ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                            : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                                        }`}
                                      >
                                        {isAssigned && <CheckCircle2 className="w-3 h-3 inline mr-1" />}
                                        {perm.permission_id}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Lock className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Selecciona un rol para ver y editar sus permisos</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Assignments Tab */}
      {activeTab === 'assignments' && (
        <div className="grid grid-cols-2 gap-6">
          {/* Staff List */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Personal</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {staffProfiles.map(staff => (
                <button
                  key={staff.id}
                  onClick={() => setSelectedStaff(staff)}
                  className={`w-full text-left px-4 py-2 rounded border-2 transition ${
                    selectedStaff?.id === staff.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-medium text-gray-900">
                    {staff.first_name} {staff.last_name}
                  </div>
                  <div className="text-sm text-gray-600">{staff.email}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Role Assignment */}
          <div className="space-y-4">
            {selectedStaff ? (
              <>
                <h3 className="text-lg font-semibold text-gray-900">
                  Roles de {selectedStaff.first_name}
                </h3>

                <div className="space-y-4">
                  {/* Assigned Roles */}
                  {staffRoles.length > 0 && (
                    <div className="bg-green-50 rounded-lg p-4">
                      <h4 className="font-medium text-green-900 mb-3">Roles Asignados</h4>
                      <div className="space-y-2">
                        {staffRoles.map(assignment => (
                          <div
                            key={assignment.id}
                            className="flex items-center justify-between bg-white p-2 rounded border border-green-200"
                          >
                            <div className="text-sm">
                              <div className="font-medium text-gray-900">
                                {(assignment.roles as any)?.name}
                              </div>
                              {assignment.department_id && (
                                <div className="text-xs text-gray-600">
                                  Departamento: {(assignment.departments as any)?.name}
                                </div>
                              )}
                            </div>
                            <button
                              onClick={() => handleRemoveRoleFromStaff(assignment.id)}
                              className="text-red-600 hover:text-red-800 p-1"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Available Roles to Assign */}
                  <div className="bg-blue-50 rounded-lg p-4">
                    <h4 className="font-medium text-blue-900 mb-3">Roles Disponibles</h4>
                    <div className="space-y-2">
                      {roles
                        .filter(r => !staffRoles.some(sr => (sr.roles as any)?.id === r.id))
                        .map(role => (
                          <button
                            key={role.id}
                            onClick={() => handleAssignRoleToStaff(role.id)}
                            className="w-full text-left px-3 py-2 bg-white border border-blue-200 rounded hover:border-blue-400 text-sm"
                          >
                            <div className="font-medium text-gray-900">{role.name}</div>
                            <div className="text-xs text-gray-600">{role.description || 'Sin descripción'}</div>
                          </button>
                        ))}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Users2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Selecciona un miembro del staff para ver y asignar roles</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* New Role Modal */}
      {showNewRoleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Crear Nuevo Rol</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre del Rol
                </label>
                <input
                  type="text"
                  value={newRoleName}
                  onChange={e => setNewRoleName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ej. Admin Académico"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descripción (opcional)
                </label>
                <textarea
                  value={newRoleDesc}
                  onChange={e => setNewRoleDesc(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Describe el propósito de este rol"
                  rows={3}
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowNewRoleModal(false)}
                  className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreateRole}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Crear Rol
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
