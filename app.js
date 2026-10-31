let config = null;
let editingTaskId = null;
let editingTaskCompleted = false;

const statusMessage = document.getElementById('status-message');
const taskForm = document.getElementById('task-form');
const taskTitleInput = document.getElementById('task-title');
const taskDescriptionInput = document.getElementById('task-description');
const taskSubmitBtn = document.getElementById('task-submit');
const taskList = document.getElementById('task-list');

function showMessage(text, isError = false) {
    statusMessage.textContent = text;
    statusMessage.className = isError ? 'error' : 'info';
    if (!isError && text) {
        setTimeout(() => {
            if (statusMessage.className === 'info') {
                statusMessage.className = '';
                statusMessage.textContent = '';
            }
        }, 3000);
    }
}

function getHeaders(extraHeaders = {}) {
    return {
        'apikey': config.supabasePublishableKey,
        'Authorization': `Bearer ${config.supabasePublishableKey}`,
        'Content-Type': 'application/json',
        ...extraHeaders
    };
}

function getBaseEndpoint() {
    const baseUrl = config.supabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
    return `${baseUrl}/rest/v1/${config.tableName}`;
}

function getBaseEndpoint() {
    const baseUrl = config.supabaseUrl.replace(/\/$/, '');
    return `${baseUrl}/rest/v1/${config.tableName}`;
}

async function loadConfig() {
    const response = await fetch('config.json');
    if (!response.ok) {
        throw new Error('Failed to load config.json');
    }
    config = await response.json();
}

// 1. GET all tasks: GET /tasks?select=*
async function fetchTasks() {
    try {
        const response = await fetch(`${getBaseEndpoint()}?select=*&order=id.asc`, {
            method: 'GET',
            headers: getHeaders()
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch tasks (HTTP ${response.status})`);
        }
        const tasks = await response.json();
        renderTasks(tasks);
    } catch (error) {
        showMessage(`Error loading tasks: ${error.message}`, true);
    }
}

// 2. GET a single task by ID: GET /tasks?id=eq.1&select=*
async function fetchTaskById(id) {
    const response = await fetch(`${getBaseEndpoint()}?id=eq.${id}&select=*`, {
        method: 'GET',
        headers: getHeaders()
    });
    if (!response.ok) {
        throw new Error(`Failed to load task #${id} (HTTP ${response.status})`);
    }
    const data = await response.json();
    return data[0];
}

// 3. POST a new task: POST /tasks
async function createTask(title, description) {
    const response = await fetch(getBaseEndpoint(), {
        method: 'POST',
        headers: getHeaders({ 'Prefer': 'return=representation' }),
        body: JSON.stringify({
            title,
            description,
            completed: false
        })
    });
    if (!response.ok) {
        throw new Error(`Failed to create task (HTTP ${response.status})`);
    }
    return await response.json();
}

// 4. PUT a complete task record: PUT /tasks?id=eq.1
async function updateTask(id, title, description, completed) {
    const response = await fetch(`${getBaseEndpoint()}?id=eq.${id}`, {
        method: 'PUT',
        headers: getHeaders({ 'Prefer': 'return=representation' }),
        body: JSON.stringify({
            id: Number(id),
            title,
            description,
            completed: Boolean(completed)
        })
    });
    if (!response.ok) {
        throw new Error(`Failed to update task #${id} (HTTP ${response.status})`);
    }
    return await response.json();
}

// 5. DELETE a task: DELETE /tasks?id=eq.1
async function deleteTask(id) {
    const response = await fetch(`${getBaseEndpoint()}?id=eq.${id}`, {
        method: 'DELETE',
        headers: getHeaders()
    });
    if (!response.ok) {
        throw new Error(`Failed to delete task #${id} (HTTP ${response.status})`);
    }
}

function renderTasks(tasks) {
    taskList.innerHTML = '';

    tasks.forEach(task => {
        const item = document.createElement('div');
        item.className = 'task-item';
        item.dataset.id = task.id;

        const infoDiv = document.createElement('div');

        const titleEl = document.createElement('div');
        titleEl.className = 'task-title';
        titleEl.textContent = task.title;

        const descEl = document.createElement('div');
        descEl.className = 'task-description';
        descEl.textContent = task.description || '';

        const statusEl = document.createElement('div');
        statusEl.className = 'task-status';
        statusEl.textContent = task.completed ? 'Completed' : 'Incomplete';

        infoDiv.appendChild(titleEl);
        infoDiv.appendChild(descEl);
        infoDiv.appendChild(statusEl);

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'task-actions';

        const toggleBtn = document.createElement('button');
        toggleBtn.type = 'button';
        toggleBtn.className = 'toggle-task';
        toggleBtn.textContent = task.completed ? 'Mark Incomplete' : 'Mark Completed';
        toggleBtn.addEventListener('click', () => handleToggleTask(task));

        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'edit-task';
        editBtn.textContent = 'Edit';
        editBtn.addEventListener('click', () => handleStartEdit(task.id));

        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'delete-task';
        deleteBtn.textContent = 'Delete';
        deleteBtn.addEventListener('click', () => handleDeleteTask(task.id));

        actionsDiv.appendChild(toggleBtn);
        actionsDiv.appendChild(editBtn);
        actionsDiv.appendChild(deleteBtn);

        item.appendChild(infoDiv);
        item.appendChild(actionsDiv);

        taskList.appendChild(item);
    });
}

async function handleStartEdit(id) {
    try {
        const task = await fetchTaskById(id);
        if (!task) {
            throw new Error('Task not found in database.');
        }
        editingTaskId = task.id;
        editingTaskCompleted = Boolean(task.completed);
        taskTitleInput.value = task.title;
        taskDescriptionInput.value = task.description || '';
        taskSubmitBtn.textContent = 'Update Task';
        taskTitleInput.focus();
    } catch (error) {
        showMessage(`Error preparing edit: ${error.message}`, true);
    }
}

async function handleToggleTask(task) {
    try {
        await updateTask(task.id, task.title, task.description || '', !task.completed);
        showMessage('Task status updated.');
        await fetchTasks();
    } catch (error) {
        showMessage(`Error toggling task status: ${error.message}`, true);
    }
}

async function handleDeleteTask(id) {
    try {
        await deleteTask(id);
        if (editingTaskId === id) {
            resetForm();
        }
        showMessage('Task deleted.');
        await fetchTasks();
    } catch (error) {
        showMessage(`Error deleting task: ${error.message}`, true);
    }
}

function resetForm() {
    editingTaskId = null;
    editingTaskCompleted = false;
    taskForm.reset();
    taskSubmitBtn.textContent = 'Save Task';
}

taskForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const title = taskTitleInput.value.trim();
    const description = taskDescriptionInput.value.trim();

    if (!title) {
        showMessage('Task title is required.', true);
        return;
    }

    try {
        if (editingTaskId !== null) {
            await updateTask(editingTaskId, title, description, editingTaskCompleted);
            showMessage('Task updated.');
        } else {
            await createTask(title, description);
            showMessage('Task added.');
        }
        resetForm();
        await fetchTasks();
    } catch (error) {
        showMessage(`Error saving task: ${error.message}`, true);
    }
});

async function init() {
    try {
        await loadConfig();
        await fetchTasks();
    } catch (error) {
        showMessage(`Initialization error: ${error.message}`, true);
    }
}

document.addEventListener('DOMContentLoaded', init);