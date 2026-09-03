
const MOCK_IDENTITIES = {
  employeeId: '00000000-0000-0000-0000-000000000011',
  employee2Id: '00000000-0000-0000-0000-000000000012',
  approverId: '00000000-0000-0000-0000-000000000022',
  approver2Id: '00000000-0000-0000-0000-000000000033'
};

const getMockUser = (token) => {
  if (token === 'TOKEN_EMP') return { data: { user: { id: MOCK_IDENTITIES.employeeId, email: 'emp@example.com' } }, error: null };
  if (token === 'TOKEN_EMP2') return { data: { user: { id: MOCK_IDENTITIES.employee2Id, email: 'emp2@example.com' } }, error: null };
  if (token === 'TOKEN_APP1' || token === 'TOKEN_APP') return { data: { user: { id: MOCK_IDENTITIES.approverId, email: 'app@example.com' } }, error: null };
  if (token === 'TOKEN_APP2') return { data: { user: { id: MOCK_IDENTITIES.approver2Id, email: 'app2@example.com' } }, error: null };
  return null;
};

module.exports = { MOCK_IDENTITIES, getMockUser };
