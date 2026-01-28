// --- DATA STORE ---
const Store = {
    getUsers: () => JSON.parse(localStorage.getItem('app_users')) || [],
    setUsers: (users) => localStorage.setItem('app_users', JSON.stringify(users)),
    
    // Content now supports 'workouts' (weekly) and 'feedbacks'
    getWorkouts: () => JSON.parse(localStorage.getItem('app_workouts')) || [],
    setWorkouts: (data) => localStorage.setItem('app_workouts', JSON.stringify(data)),
    
    getFeedbacks: () => JSON.parse(localStorage.getItem('app_feedbacks')) || [],
    setFeedbacks: (data) => localStorage.setItem('app_feedbacks', JSON.stringify(data)),
    
    init: () => {
        if (!localStorage.getItem('app_users')) {
            const admin = { id: 'admin', name: 'Enrique Araújo', user: 'admin', pass: 'admin123', role: 'admin' };
            Store.setUsers([admin]);
        }
    }
};

Store.init();

// --- STATE ---
let currentUser = null;
let currentStudentId = null; // For Admin
let currentAdminDay = 'segunda'; // Default day for editor
let currentFeedbackFile = null; // Base64 string

// --- DOM ELEMENTS ---
const screens = {
    login: document.getElementById('login-screen'),
    admin: document.getElementById('admin-dashboard'),
    client: document.getElementById('client-app')
};

// --- AUTH ---
document.getElementById('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const user = document.getElementById('login-user').value;
    const pass = document.getElementById('login-pass').value;
    
    const users = Store.getUsers();
    const found = users.find(u => u.user === user && u.pass === pass);
    
    if (found) {
        if (found.blocked) {
            showToast('Acesso bloqueado. Contate o treinador.', 'error');
            return;
        }
        login(found);
    } else {
        showToast('Credenciais inválidas', 'error');
    }
});

function login(user) {
    currentUser = user;
    screens.login.classList.remove('active-screen');
    screens.login.classList.add('hidden');
    
    if (user.role === 'admin') {
        screens.admin.classList.remove('hidden-screen');
        screens.admin.classList.add('active-screen');
        showAdminView('list-students');
    } else {
        screens.client.classList.remove('hidden-screen');
        screens.client.classList.add('active-screen');
        document.getElementById('client-name-display').textContent = user.name;
        loadClientCalendar();
    }
}

function logout() {
    location.reload();
}

// --- ADMIN LOGIC ---

function showAdminView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden-view'));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active-view'));
    
    document.getElementById(`view-${viewId}`).classList.remove('hidden-view');
    document.getElementById(`view-${viewId}`).classList.add('active-view');
    
    if(viewId === 'list-students') loadStudentList();
}

// 1. Create Student
document.getElementById('create-student-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('new-student-name').value;
    const user = document.getElementById('new-student-user').value;
    const pass = document.getElementById('new-student-pass').value;
    
    const users = Store.getUsers();
    if(users.find(u => u.user === user)) return showToast('Usuário já existe', 'error');
    
    users.push({ id: 'std_'+Date.now(), name, user, pass, role: 'student', blocked: false });
    Store.setUsers(users);
    showToast('Aluno cadastrado!');
    e.target.reset();
    showAdminView('list-students');
});

// 2. List Students
function loadStudentList() {
    const list = document.getElementById('admin-student-list');
    const students = Store.getUsers().filter(u => u.role === 'student');
    list.innerHTML = '';
    
    students.forEach(s => {
        const card = document.createElement('div');
        card.className = `student-card ${s.blocked ? 'blocked' : ''}`;
        card.innerHTML = `
            <h3>${s.name}</h3>
            <p><i class="fas fa-user"></i> ${s.user}</p>
            ${s.blocked ? '<small style="color:var(--danger)">BLOQUEADO</small>' : ''}
            <button class="btn-edit-student" onclick="openStudentEditor('${s.id}')">
                <i class="fas fa-pen"></i>
            </button>
        `;
        list.appendChild(card);
    });
}

// 3. Student Editor, Status & Delete
function openStudentEditor(studentId) {
    currentStudentId = studentId;
    const student = Store.getUsers().find(u => u.id === studentId);
    
    document.getElementById('editor-student-name').textContent = student.name;
    updateStatusUI(student.blocked);
    
    showAdminView('student-editor');
    loadAdminExercises();
    loadAdminFeedbacks();
}

function toggleStudentStatus() {
    const users = Store.getUsers();
    const idx = users.findIndex(u => u.id === currentStudentId);
    if(idx !== -1) {
        users[idx].blocked = !users[idx].blocked;
        Store.setUsers(users);
        updateStatusUI(users[idx].blocked);
        showToast(users[idx].blocked ? 'Aluno bloqueado' : 'Aluno desbloqueado');
    }
}

function deleteCurrentStudent() {
    if(!confirm('ATENÇÃO: Tem certeza que deseja EXCLUIR este aluno? \n\nTodos os treinos e históricos de mensagens serão apagados permanentemente.')) return;
    
    // 1. Remove User
    let users = Store.getUsers();
    users = users.filter(u => u.id !== currentStudentId);
    Store.setUsers(users);
    
    // 2. Remove Workouts
    let workouts = Store.getWorkouts();
    workouts = workouts.filter(w => w.studentId !== currentStudentId);
    Store.setWorkouts(workouts);
    
    // 3. Remove Feedbacks
    let feedbacks = Store.getFeedbacks();
    feedbacks = feedbacks.filter(f => f.studentId !== currentStudentId);
    Store.setFeedbacks(feedbacks);
    
    showToast('Aluno excluído com sucesso.');
    showAdminView('list-students');
}

function updateStatusUI(isBlocked) {
    const badge = document.getElementById('student-status-badge');
    const btn = document.getElementById('btn-toggle-status');
    
    if(isBlocked) {
        badge.textContent = 'BLOQUEADO';
        badge.classList.add('blocked');
        btn.textContent = 'Desbloquear Aluno';
        btn.style.background = 'rgba(0, 230, 118, 0.1)';
        btn.style.color = 'var(--primary)';
    } else {
        badge.textContent = 'ATIVO';
        badge.classList.remove('blocked');
        btn.textContent = 'Bloquear Aluno';
        btn.style.background = 'rgba(255, 71, 87, 0.1)';
        btn.style.color = 'var(--danger)';
    }
}

function openEditorTab(tabName) {
    document.querySelectorAll('.tab-link').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.editor-tab-content').forEach(c => c.classList.add('hidden'));
    document.querySelectorAll('.editor-tab-content').forEach(c => c.classList.remove('active'));
    
    // Activate logic (simple toggle)
    if(tabName === 'treinos') {
        document.querySelector('.tab-link:nth-child(1)').classList.add('active');
        document.getElementById('tab-treinos').classList.remove('hidden');
    } else {
        document.querySelector('.tab-link:nth-child(2)').classList.add('active');
        document.getElementById('tab-feedbacks').classList.remove('hidden');
    }
}

// --- WORKOUT BUILDER ---

function selectAdminDay(day) {
    currentAdminDay = day;
    document.querySelectorAll('.day-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
    
    const labels = { segunda: 'Segunda-Feira', terca: 'Terça-Feira', quarta: 'Quarta-Feira', quinta: 'Quinta-Feira', sexta: 'Sexta-Feira', sabado: 'Sábado', domingo: 'Domingo' };
    document.getElementById('current-day-label').textContent = labels[day];
    
    loadAdminExercises();
}

function loadAdminExercises() {
    const workouts = Store.getWorkouts();
    // Find workouts for this student AND this day
    const dayExercises = workouts.filter(w => w.studentId === currentStudentId && w.day === currentAdminDay);
    
    const list = document.getElementById('admin-day-exercises');
    list.innerHTML = '';
    
    if(dayExercises.length === 0) {
        list.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted)">Sem exercícios neste dia.</div>';
        return;
    }
    
    dayExercises.forEach(ex => {
        const item = document.createElement('div');
        item.className = 'exercise-item';
        item.innerHTML = `
            <div class="ex-info">
                <h4>${ex.name}</h4>
                <small>${ex.sets} x ${ex.reps} ${ex.obs ? '| ' + ex.obs : ''}</small>
            </div>
            <div class="ex-actions">
                ${ex.video ? '<i class="fas fa-video" style="color:var(--primary)"></i>' : ''}
                <button class="btn-del" onclick="deleteExercise('${ex.id}')"><i class="fas fa-trash"></i></button>
            </div>
        `;
        list.appendChild(item);
    });
}

function openExerciseModal() {
    document.getElementById('exercise-modal').classList.remove('hidden');
}
function closeExerciseModal() {
    document.getElementById('exercise-modal').classList.add('hidden');
    document.getElementById('form-add-exercise').reset();
}

document.getElementById('form-add-exercise').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const newEx = {
        id: 'ex_' + Date.now(),
        studentId: currentStudentId,
        day: currentAdminDay,
        name: document.getElementById('ex-name').value,
        sets: document.getElementById('ex-sets').value,
        reps: document.getElementById('ex-reps').value,
        video: document.getElementById('ex-video').value,
        obs: document.getElementById('ex-obs').value
    };
    
    const workouts = Store.getWorkouts();
    workouts.push(newEx);
    Store.setWorkouts(workouts);
    
    closeExerciseModal();
    loadAdminExercises();
    showToast('Exercício adicionado!');
});

function deleteExercise(id) {
    if(!confirm('Excluir exercício?')) return;
    let workouts = Store.getWorkouts();
    workouts = workouts.filter(w => w.id !== id);
    Store.setWorkouts(workouts);
    loadAdminExercises();
}

// --- FEEDBACKS (ADMIN) ---

// File Handling (Base64)
function handleFileSelect(input) {
    const file = input.files[0];
    if(file) {
        if(file.size > 2000000) return showToast('Arquivo muito grande (Max 2MB)', 'error'); // Limit 2MB
        
        const reader = new FileReader();
        reader.onload = function(e) {
            currentFeedbackFile = e.target.result;
            document.getElementById('file-preview-name').textContent = `📎 ${file.name}`;
        };
        reader.readAsDataURL(file);
    }
}

document.getElementById('form-feedback').addEventListener('submit', (e) => {
    e.preventDefault();
    const msg = document.getElementById('feedback-msg').value;
    createFeedback(currentStudentId, msg, currentFeedbackFile, 'admin');
    e.target.reset();
    currentFeedbackFile = null;
    document.getElementById('file-preview-name').textContent = '';
});

// Common Create Feedback Function
function createFeedback(studentId, msg, file, author) {
    const newFb = {
        id: 'fb_' + Date.now(),
        studentId: studentId,
        msg: msg,
        file: file,
        date: new Date().toISOString(),
        author: author
    };
    
    const feedbacks = Store.getFeedbacks();
    feedbacks.push(newFb);
    Store.setFeedbacks(feedbacks);
    
    if(author === 'admin') loadAdminFeedbacks();
    else loadClientFeedbacks();
    
    showToast('Mensagem enviada!');
}

function loadAdminFeedbacks() {
    const list = document.getElementById('feedback-list-admin');
    const all = Store.getFeedbacks().filter(f => f.studentId === currentStudentId).reverse();
    
    list.innerHTML = '';
    all.forEach(fb => {
        const item = document.createElement('div');
        item.className = 'feedback-card';
        item.innerHTML = `
            <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                <span style="color:${fb.author === 'admin' ? 'var(--primary)' : 'white'}">${fb.author === 'admin' ? 'Você' : 'Aluno'}</span>
                <small style="color:var(--text-muted)">${new Date(fb.date).toLocaleDateString()}</small>
            </div>
            <p>${fb.msg}</p>
            ${fb.file ? `<img src="${fb.file}" class="feedback-img">` : ''}
        `;
        list.appendChild(item);
    });
}


// --- CLIENT LOGIC ---

function showClientTab(tab) {
    document.querySelectorAll('.client-view').forEach(v => v.classList.add('hidden'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    
    document.getElementById(`client-view-${tab}`).classList.remove('hidden');
    
    if(tab === 'treinos') {
        document.querySelector('.nav-item:nth-child(1)').classList.add('active');
        loadClientCalendar();
    } else {
        document.querySelector('.nav-item:nth-child(2)').classList.add('active');
        loadClientFeedbacks();
    }
}

function loadClientCalendar() {
    const container = document.querySelector('.horizontal-calendar');
    container.innerHTML = '';
    
    const days = [
        { key: 'segunda', label: 'SEG', full: 'Segunda-Feira' },
        { key: 'terca', label: 'TER', full: 'Terça-Feira' },
        { key: 'quarta', label: 'QUA', full: 'Quarta-Feira' },
        { key: 'quinta', label: 'QUI', full: 'Quinta-Feira' },
        { key: 'sexta', label: 'SEX', full: 'Sexta-Feira' },
        { key: 'sabado', label: 'SÁB', full: 'Sábado' },
        { key: 'domingo', label: 'DOM', full: 'Domingo' }
    ];
    
    // Auto-select current day (simulation, mapping JS day to our keys)
    const jsDay = new Date().getDay(); // 0 = Sun, 1 = Mon
    const map = [6, 0, 1, 2, 3, 4, 5]; // Shift to make Monday index 0
    let activeIdx = map[jsDay-1 < -1 ? 6 : jsDay-1];
    if (activeIdx === undefined) activeIdx = 0; // Default Monday

    // Check if we have manually selected a day stored in a variable, else use today
    // For simplicity, let's just default to Monday or first day
    
    days.forEach((d, idx) => {
        const div = document.createElement('div');
        div.className = `cal-day ${idx === activeIdx ? 'active' : ''}`; // Just highlighting Monday as default for demo
        div.onclick = () => {
            document.querySelectorAll('.cal-day').forEach(cd => cd.classList.remove('active'));
            div.classList.add('active');
            loadClientWorkout(d.key, d.full);
        };
        div.innerHTML = `<span>${d.label}</span><strong>${new Date().getDate() + idx}</strong>`; // Fake dates
        container.appendChild(div);
        
        if(idx === activeIdx) loadClientWorkout(d.key, d.full);
    });
}

function loadClientWorkout(dayKey, dayFullLabel) {
    document.getElementById('client-day-title').textContent = dayFullLabel;
    const list = document.getElementById('client-workout-list');
    list.innerHTML = '';
    
    const workouts = Store.getWorkouts().filter(w => w.studentId === currentUser.id && w.day === dayKey);
    
    if(workouts.length === 0) {
        list.innerHTML = '<div style="text-align:center; padding:30px; color:var(--text-muted)">Descanso hoje! 😴</div>';
        return;
    }
    
    workouts.forEach(ex => {
        // Video Embed Helper
        let videoEmbed = `<div class="no-video-placeholder"><i class="fas fa-video-slash"></i></div>`;
        if(ex.video) {
            // Simple check for Youtube
            if(ex.video.includes('youtu')) {
                const videoId = ex.video.split('v=')[1]?.split('&')[0] || ex.video.split('/').pop();
                videoEmbed = `<div class="video-preview"><iframe src="https://www.youtube.com/embed/${videoId}" allowfullscreen></iframe></div>`;
            } else {
                videoEmbed = `<div class="no-video-placeholder"><a href="${ex.video}" target="_blank" style="color:var(--primary)">Ver Vídeo</a></div>`;
            }
        }
        
        const card = document.createElement('div');
        card.className = 'workout-card';
        card.innerHTML = `
            ${videoEmbed}
            <div class="card-body">
                <h4>${ex.name}</h4>
                <div class="card-meta">
                    <span><i class="fas fa-layer-group"></i> ${ex.sets} Séries</span>
                    <span><i class="fas fa-stopwatch"></i> ${ex.reps}</span>
                </div>
                ${ex.obs ? `<div class="card-obs">📝 ${ex.obs}</div>` : ''}
            </div>
        `;
        list.appendChild(card);
    });
}

// Client Feedback Logic
document.getElementById('form-client-feedback').addEventListener('submit', (e) => {
    e.preventDefault();
    const msg = document.getElementById('client-feedback-msg').value;
    createFeedback(currentUser.id, msg, null, 'student'); // Student sends no file for now
    e.target.reset();
});

function loadClientFeedbacks() {
    const list = document.getElementById('client-feedback-list');
    const all = Store.getFeedbacks().filter(f => f.studentId === currentUser.id).reverse();
    
    list.innerHTML = '';
    if(all.length === 0) list.innerHTML = '<p style="text-align:center; padding:20px;">Nenhum feedback.</p>';
    
    all.forEach(fb => {
        const item = document.createElement('div');
        item.className = 'feedback-card';
        item.innerHTML = `
            <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                <span style="font-weight:700; color:${fb.author === 'admin' ? 'var(--primary)' : 'white'}">${fb.author === 'admin' ? 'Treinador' : 'Você'}</span>
                <small style="color:var(--text-muted)">${new Date(fb.date).toLocaleDateString()}</small>
            </div>
            <p>${fb.msg}</p>
            ${fb.file ? `<img src="${fb.file}" class="feedback-img">` : ''}
        `;
        list.appendChild(item);
    });
}

// Helper Toast
function showToast(msg, type='success') {
    const box = document.createElement('div');
    box.style.cssText = `position:fixed; top:20px; right:20px; background:${type==='error'?'#ff4757':'#00e676'}; color:${type==='error'?'white':'black'}; padding:15px; border-radius:8px; z-index:9999; font-weight:600; animation:fadeIn 0.3s`;
    box.textContent = msg;
    document.body.appendChild(box);
    setTimeout(()=>box.remove(), 3000);
}

// Global scope
window.showAdminView = showAdminView;
window.selectAdminDay = selectAdminDay;
window.openExerciseModal = openExerciseModal;
window.closeExerciseModal = closeExerciseModal;
window.logout = logout;
window.openStudentEditor = openStudentEditor;
window.openEditorTab = openEditorTab;
window.deleteExercise = deleteExercise;
window.handleFileSelect = handleFileSelect;
window.showClientTab = showClientTab;
window.toggleStudentStatus = toggleStudentStatus;
window.deleteCurrentStudent = deleteCurrentStudent; // Exposed function
