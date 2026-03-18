/**
 * Set up admin panel event listeners
 */
export function setupAdminEventListeners() {
  document.getElementById('admin-add-user-btn')?.addEventListener('click', () => openUserModal());
  document.getElementById('user-modal-close')?.addEventListener('click', closeUserModal);
  document.getElementById('user-cancel-btn')?.addEventListener('click', closeUserModal);
  document.getElementById('user-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'user-modal') closeUserModal();
  });
  document.getElementById('user-form')?.addEventListener('submit', handleUserSubmit);
  document.getElementById('reset-pw-close')?.addEventListener('click', closeResetPwModal);
  document.getElementById('reset-pw-cancel')?.addEventListener('click', closeResetPwModal);
  document.getElementById('reset-pw-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'reset-pw-modal') closeResetPwModal();
  });
  document.getElementById('reset-pw-form')?.addEventListener('submit', handleResetPassword);
}

function openUserModal() {
  document.getElementById('user-modal')?.classList.remove('hidden');
}

function closeUserModal() {
  document.getElementById('user-modal')?.classList.add('hidden');
}

async function handleUserSubmit(e) {
  e.preventDefault();
  // TODO: Implement user creation/editing
}

function closeResetPwModal() {
  document.getElementById('reset-pw-modal')?.classList.add('hidden');
}

async function handleResetPassword(e) {
  e.preventDefault();
  // TODO: Implement password reset
}
