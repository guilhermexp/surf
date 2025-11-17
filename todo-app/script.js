/**
 * Todo Task Manager Application
 * A feature-rich task management app with localStorage persistence
 */

class TodoApp {
  constructor() {
    this.tasks = []
    this.currentFilter = 'all'
    this.storageKey = 'todoAppTasks'

    // DOM Elements
    this.taskInput = document.getElementById('taskInput')
    this.addBtn = document.getElementById('addBtn')
    this.tasksList = document.getElementById('tasksList')
    this.filterBtns = document.querySelectorAll('.filter-btn')
    this.clearCompletedBtn = document.getElementById('clearCompletedBtn')
    this.totalTasksSpan = document.getElementById('totalTasks')
    this.completedTasksSpan = document.getElementById('completedTasks')
    this.remainingTasksSpan = document.getElementById('remainingTasks')
    this.emptyState = document.getElementById('emptyState')

    this.init()
  }

  /**
   * Initialize the application
   */
  init() {
    this.loadTasks()
    this.setupEventListeners()
    this.render()
  }

  /**
   * Setup all event listeners
   */
  setupEventListeners() {
    // Add task
    this.addBtn.addEventListener('click', () => this.addTask())
    this.taskInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.addTask()
    })

    // Filter tasks
    this.filterBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => this.handleFilterChange(e))
    })

    // Clear completed tasks
    this.clearCompletedBtn.addEventListener('click', () => this.clearCompleted())

    // Focus on input when page loads
    this.taskInput.focus()
  }

  /**
   * Add a new task
   */
  addTask() {
    const text = this.taskInput.value.trim()

    if (!text) {
      this.showNotification('Please enter a task', 'warning')
      this.taskInput.focus()
      return
    }

    if (text.length > 500) {
      this.showNotification('Task is too long (max 500 characters)', 'warning')
      return
    }

    const task = {
      id: Date.now(),
      text: text,
      completed: false,
      createdAt: new Date().toISOString()
    }

    this.tasks.unshift(task)
    this.taskInput.value = ''
    this.taskInput.focus()
    this.saveTasks()
    this.render()
    this.showNotification('Task added successfully!', 'success')
  }

  /**
   * Delete a task by ID
   */
  deleteTask(id) {
    const taskIndex = this.tasks.findIndex((t) => t.id === id)
    if (taskIndex > -1) {
      const taskItem = document.querySelector(`[data-id="${id}"]`)
      if (taskItem) {
        taskItem.classList.add('deleting')
        setTimeout(() => {
          this.tasks.splice(taskIndex, 1)
          this.saveTasks()
          this.render()
          this.showNotification('Task deleted', 'info')
        }, 300)
      }
    }
  }

  /**
   * Toggle task completion status
   */
  toggleTask(id) {
    const task = this.tasks.find((t) => t.id === id)
    if (task) {
      task.completed = !task.completed
      this.saveTasks()
      this.render()
    }
  }

  /**
   * Handle filter button clicks
   */
  handleFilterChange(e) {
    const button = e.currentTarget
    this.filterBtns.forEach((btn) => btn.classList.remove('active'))
    button.classList.add('active')
    this.currentFilter = button.dataset.filter
    this.render()
  }

  /**
   * Clear all completed tasks
   */
  clearCompleted() {
    const completedCount = this.tasks.filter((t) => t.completed).length

    if (completedCount === 0) {
      this.showNotification('No completed tasks to clear', 'info')
      return
    }

    if (confirm(`Delete ${completedCount} completed task(s)?`)) {
      this.tasks = this.tasks.filter((t) => !t.completed)
      this.saveTasks()
      this.render()
      this.showNotification(`${completedCount} task(s) deleted`, 'success')
    }
  }

  /**
   * Get filtered tasks based on current filter
   */
  getFilteredTasks() {
    switch (this.currentFilter) {
      case 'completed':
        return this.tasks.filter((t) => t.completed)
      case 'active':
        return this.tasks.filter((t) => !t.completed)
      case 'all':
      default:
        return this.tasks
    }
  }

  /**
   * Update statistics
   */
  updateStats() {
    const total = this.tasks.length
    const completed = this.tasks.filter((t) => t.completed).length
    const remaining = total - completed

    this.totalTasksSpan.textContent = total
    this.completedTasksSpan.textContent = completed
    this.remainingTasksSpan.textContent = remaining

    // Disable clear completed button if no completed tasks
    this.clearCompletedBtn.disabled = completed === 0
  }

  /**
   * Render all tasks
   */
  render() {
    this.updateStats()

    const filteredTasks = this.getFilteredTasks()
    this.tasksList.innerHTML = ''

    if (filteredTasks.length === 0) {
      this.emptyState.style.display = 'flex'
      if (this.currentFilter === 'completed') {
        this.emptyState.querySelector('.empty-text').textContent = 'No completed tasks yet!'
      } else if (this.currentFilter === 'active') {
        this.emptyState.querySelector('.empty-text').textContent = 'All tasks completed! Great job!'
      } else {
        this.emptyState.querySelector('.empty-text').textContent =
          'No tasks yet. Add one to get started!'
      }
      return
    }

    this.emptyState.style.display = 'none'

    filteredTasks.forEach((task) => {
      const taskElement = this.createTaskElement(task)
      this.tasksList.appendChild(taskElement)
    })
  }

  /**
   * Create a task element
   */
  createTaskElement(task) {
    const li = document.createElement('li')
    li.className = `task-item ${task.completed ? 'completed' : ''}`
    li.dataset.id = task.id

    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    checkbox.className = 'task-checkbox'
    checkbox.checked = task.completed
    checkbox.addEventListener('change', () => this.toggleTask(task.id))

    const content = document.createElement('div')
    content.className = 'task-content'

    const text = document.createElement('span')
    text.className = 'task-text'
    text.textContent = task.text
    text.title = task.text

    content.appendChild(text)

    const actions = document.createElement('div')
    actions.className = 'task-actions'

    const deleteBtn = document.createElement('button')
    deleteBtn.className = 'delete-btn'
    deleteBtn.title = 'Delete task'
    deleteBtn.innerHTML = '🗑️'
    deleteBtn.addEventListener('click', () => this.deleteTask(task.id))

    actions.appendChild(deleteBtn)

    li.appendChild(checkbox)
    li.appendChild(content)
    li.appendChild(actions)

    return li
  }

  /**
   * Save tasks to localStorage
   */
  saveTasks() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.tasks))
    } catch (e) {
      if (e instanceof QuotaExceededError) {
        this.showNotification('Storage limit exceeded!', 'error')
      } else {
        console.error('Error saving tasks:', e)
      }
    }
  }

  /**
   * Load tasks from localStorage
   */
  loadTasks() {
    try {
      const stored = localStorage.getItem(this.storageKey)
      this.tasks = stored ? JSON.parse(stored) : []

      // Validate tasks
      this.tasks = this.tasks.filter(
        (task) => task.id && task.text && typeof task.completed === 'boolean'
      )
    } catch (e) {
      console.error('Error loading tasks:', e)
      this.tasks = []
    }
  }

  /**
   * Show notification (simple implementation)
   */
  showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div')
    notification.className = `notification notification-${type}`
    notification.textContent = message
    notification.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 1rem 1.5rem;
            background: ${type === 'success' ? '#10b981' : type === 'warning' ? '#f59e0b' : type === 'error' ? '#ef4444' : '#3b82f6'};
            color: white;
            border-radius: 0.5rem;
            font-weight: 500;
            z-index: 1000;
            animation: slideInUp 0.3s ease-out;
            box-shadow: 0 10px 15px rgba(0, 0, 0, 0.1);
        `

    // Add animation
    const style = document.createElement('style')
    if (!document.querySelector('style[data-notification]')) {
      style.setAttribute('data-notification', 'true')
      style.textContent = `
                @keyframes slideInUp {
                    from {
                        transform: translateY(100px);
                        opacity: 0;
                    }
                    to {
                        transform: translateY(0);
                        opacity: 1;
                    }
                }
            `
      document.head.appendChild(style)
    }

    document.body.appendChild(notification)

    // Remove notification after 3 seconds
    setTimeout(() => {
      notification.style.animation = 'slideInUp 0.3s ease-out reverse'
      setTimeout(() => notification.remove(), 300)
    }, 3000)
  }

  /**
   * Export tasks as JSON
   */
  exportTasks() {
    const dataStr = JSON.stringify(this.tasks, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `tasks-${new Date().toISOString().split('T')[0]}.json`
    link.click()
    this.showNotification('Tasks exported!', 'success')
  }

  /**
   * Import tasks from JSON
   */
  importTasks(file) {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target.result)
        if (Array.isArray(imported)) {
          this.tasks = imported
          this.saveTasks()
          this.render()
          this.showNotification('Tasks imported successfully!', 'success')
        } else {
          this.showNotification('Invalid file format', 'error')
        }
      } catch (error) {
        this.showNotification('Error importing tasks', 'error')
      }
    }
    reader.readAsText(file)
  }

  /**
   * Clear all tasks
   */
  clearAllTasks() {
    if (this.tasks.length === 0) {
      this.showNotification('No tasks to clear', 'info')
      return
    }

    if (confirm(`Delete all ${this.tasks.length} task(s)? This cannot be undone.`)) {
      this.tasks = []
      this.saveTasks()
      this.render()
      this.showNotification('All tasks cleared', 'success')
    }
  }

  /**
   * Search tasks
   */
  searchTasks(query) {
    if (!query.trim()) {
      this.render()
      return
    }

    const filtered = this.tasks.filter((task) =>
      task.text.toLowerCase().includes(query.toLowerCase())
    )

    this.tasksList.innerHTML = ''
    if (filtered.length === 0) {
      this.emptyState.style.display = 'flex'
      this.emptyState.querySelector('.empty-text').textContent = 'No tasks match your search'
      return
    }

    this.emptyState.style.display = 'none'
    filtered.forEach((task) => {
      const taskElement = this.createTaskElement(task)
      this.tasksList.appendChild(taskElement)
    })
  }

  /**
   * Get task statistics
   */
  getStats() {
    return {
      total: this.tasks.length,
      completed: this.tasks.filter((t) => t.completed).length,
      active: this.tasks.filter((t) => !t.completed).length,
      completionRate:
        this.tasks.length > 0
          ? Math.round((this.tasks.filter((t) => t.completed).length / this.tasks.length) * 100)
          : 0
    }
  }
}

// Initialize the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.todoApp = new TodoApp()
})

// Service Worker registration for offline support (optional)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {
      // Service worker registration failed, app will still work
    })
  })
}
