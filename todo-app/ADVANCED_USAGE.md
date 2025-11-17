# Advanced Usage Guide

This guide covers advanced features and programming patterns for the Todo Task Manager.

## Table of Contents

1. [Using the JavaScript API](#using-the-javascript-api)
2. [Extending the Application](#extending-the-application)
3. [Browser Console Commands](#browser-console-commands)
4. [Data Manipulation](#data-manipulation)
5. [Custom Styling](#custom-styling)
6. [Integration Examples](#integration-examples)

## Using the JavaScript API

### Accessing the App Instance

Once the page loads, you can access the `TodoApp` instance globally:

```javascript
// Access the app instance
const app = window.todoApp

// Or use it directly
window.todoApp.addTask()
```

### Adding Tasks Programmatically

```javascript
// Direct method
app.addTask() // Uses current input value

// Via input manipulation
document.getElementById('taskInput').value = 'New task'
app.addTask()

// Creating task object directly (advanced)
const newTask = {
  id: Date.now(),
  text: 'Buy milk',
  completed: false,
  createdAt: new Date().toISOString()
}
app.tasks.unshift(newTask)
app.saveTasks()
app.render()
```

### Filtering and Searching

```javascript
// Get all tasks by filter
const active = app.tasks.filter((t) => !t.completed)
const completed = app.tasks.filter((t) => t.completed)

// Search by text
app.searchTasks('buy')

// Complex search
const urgent = app.tasks.filter((t) => t.text.toLowerCase().includes('urgent') && !t.completed)
```

### Task Statistics

```javascript
// Get comprehensive stats
const stats = app.getStats()
console.log(`Progress: ${stats.completionRate}%`)
console.log(`Remaining: ${stats.active} tasks`)

// Custom statistics
const avgTasksPerDay =
  app.tasks.length /
  ((new Date() - new Date(app.tasks[0]?.createdAt || new Date())) / (1000 * 60 * 60 * 24))

// Count tasks by prefix
const countByPrefix = (prefix) => {
  return app.tasks.filter((t) => t.text.startsWith(prefix)).length
}
console.log('Tasks starting with "Buy":', countByPrefix('Buy'))
```

## Extending the Application

### Adding New Methods to TodoApp

```javascript
// Add to script.js or in browser console
TodoApp.prototype.duplicateTask = function (id) {
  const task = this.tasks.find((t) => t.id === id)
  if (task) {
    const duplicate = {
      ...task,
      id: Date.now(),
      completed: false
    }
    this.tasks.unshift(duplicate)
    this.saveTasks()
    this.render()
  }
}

// Usage
app.duplicateTask(1234567890)
```

### Adding Priority Support

```javascript
// Modify task creation
const taskWithPriority = {
  id: Date.now(),
  text: 'Buy milk',
  completed: false,
  priority: 'high', // or 'medium', 'low'
  createdAt: new Date().toISOString()
}

// Sort by priority
const sortedByPriority = app.tasks.sort((a, b) => {
  const priorityMap = { high: 3, medium: 2, low: 1 }
  return (priorityMap[b.priority] || 0) - (priorityMap[a.priority] || 0)
})
```

### Adding Due Dates

```javascript
// Extend task structure
const taskWithDueDate = {
  id: Date.now(),
  text: 'Pay bills',
  completed: false,
  dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
  createdAt: new Date().toISOString()
}

// Find overdue tasks
const overdue = app.tasks.filter(
  (t) => t.dueDate && new Date(t.dueDate) < new Date() && !t.completed
)

// Sort by due date
const sortedByDueDate = app.tasks.sort(
  (a, b) => new Date(a.dueDate || Infinity) - new Date(b.dueDate || Infinity)
)
```

## Browser Console Commands

### Basic Operations

```javascript
// Add multiple tasks at once
;['Task 1', 'Task 2', 'Task 3'].forEach((text) => {
  app.taskInput.value = text
  app.addTask()
})

// Mark all as complete
app.tasks.forEach((t) => (t.completed = true))
app.saveTasks()
app.render()

// Undo (get previous state from localStorage)
// Note: This would require storing history
```

### Inspection Commands

```javascript
// View all tasks
console.table(app.tasks)

// View current filter
console.log('Current filter:', app.currentFilter)

// Get localStorage size
const size = new Blob([localStorage.todoAppTasks]).size
console.log('Storage used:', (size / 1024).toFixed(2), 'KB')

// List all task IDs
app.tasks.map((t) => t.id)

// Find specific task
const findTask = (query) => {
  return app.tasks.find((t) => t.text.toLowerCase().includes(query.toLowerCase()))
}
const task = findTask('buy')
```

### Data Export Commands

```javascript
// Export as CSV
const csv =
  'Text,Completed,Created\n' +
  app.tasks.map((t) => `"${t.text}",${t.completed},"${t.createdAt}"`).join('\n')
console.log(csv)

// Export as simple list
const list = app.tasks.map((t) => `${t.completed ? '✓' : '○'} ${t.text}`).join('\n')
console.log(list)

// Export with timestamps
const detailed = app.tasks.map((t) => ({
  text: t.text,
  completed: t.completed,
  age: new Date() - new Date(t.createdAt),
  ageInDays: Math.floor((new Date() - new Date(t.createdAt)) / (1000 * 60 * 60 * 24))
}))
console.table(detailed)
```

## Data Manipulation

### Backup and Restore

```javascript
// Create backup
function createBackup() {
  const backup = {
    timestamp: new Date().toISOString(),
    tasks: app.tasks,
    version: '1.0'
  }
  localStorage.setItem('todoAppBackup', JSON.stringify(backup))
  console.log('Backup created')
}

// Restore from backup
function restoreBackup() {
  const backup = JSON.parse(localStorage.getItem('todoAppBackup'))
  if (backup && confirm('Restore from backup?')) {
    app.tasks = backup.tasks
    app.saveTasks()
    app.render()
    console.log('Backup restored')
  }
}

createBackup()
restoreBackup()
```

### Merge Multiple Datasets

```javascript
// Merge tasks from two sources
function mergeTasks(externalTasks) {
  // Avoid duplicates by checking text
  const existingTexts = app.tasks.map((t) => t.text.toLowerCase())
  const newTasks = externalTasks.filter((t) => !existingTexts.includes(t.text.toLowerCase()))
  app.tasks = [...app.tasks, ...newTasks]
  app.saveTasks()
  app.render()
  console.log(`${newTasks.length} new tasks added`)
}

// Usage
const importedTasks = [
  { id: 1, text: 'Imported task 1', completed: false, createdAt: new Date().toISOString() },
  { id: 2, text: 'Imported task 2', completed: false, createdAt: new Date().toISOString() }
]
mergeTasks(importedTasks)
```

### Transform and Clean Data

```javascript
// Remove duplicate tasks
function removeDuplicates() {
  const seen = new Set()
  app.tasks = app.tasks.filter((t) => {
    if (seen.has(t.text.toLowerCase())) {
      return false
    }
    seen.add(t.text.toLowerCase())
    return true
  })
  app.saveTasks()
  app.render()
}

// Normalize text (trim, capitalize)
function normalizeAllTasks() {
  app.tasks = app.tasks.map((t) => ({
    ...t,
    text: t.text.trim().charAt(0).toUpperCase() + t.text.trim().slice(1).toLowerCase()
  }))
  app.saveTasks()
  app.render()
}

// Archive old completed tasks
function archiveOldCompleted(daysOld = 30) {
  const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000)
  const archived = app.tasks.filter((t) => t.completed && new Date(t.createdAt) < cutoffDate)
  app.tasks = app.tasks.filter((t) => !archived.includes(t))

  // Save archived to separate storage
  const currentArchive = JSON.parse(localStorage.getItem('todoAppArchive') || '[]')
  localStorage.setItem('todoAppArchive', JSON.stringify([...currentArchive, ...archived]))

  app.saveTasks()
  app.render()
  console.log(`${archived.length} old tasks archived`)
}
```

## Custom Styling

### Dark Mode

```javascript
// Add to styles.css
const darkModeCSS = `
@media (prefers-color-scheme: dark) {
    :root {
        --primary-color: #818cf8;
        --text-primary: #f3f4f6;
        --text-secondary: #d1d5db;
        --bg-primary: #1f2937;
        --bg-secondary: #111827;
        --border-color: #4b5563;
    }
}

/* Manual dark mode toggle */
body.dark-mode {
    --text-primary: #f3f4f6;
    --bg-primary: #1f2937;
    --bg-secondary: #111827;
}
`

// Toggle dark mode
document.body.classList.toggle('dark-mode')
```

### Custom Themes

```javascript
function setTheme(theme) {
  const themes = {
    ocean: {
      primary: '#0066cc',
      success: '#009900',
      danger: '#cc0000'
    },
    sunset: {
      primary: '#ff6b35',
      success: '#f7931e',
      danger: '#c81d25'
    },
    forest: {
      primary: '#2d6a4f',
      success: '#40916c',
      danger: '#d62828'
    }
  }

  const selectedTheme = themes[theme]
  if (selectedTheme) {
    document.documentElement.style.setProperty('--primary-color', selectedTheme.primary)
    document.documentElement.style.setProperty('--success-color', selectedTheme.success)
    document.documentElement.style.setProperty('--danger-color', selectedTheme.danger)
    localStorage.setItem('selectedTheme', theme)
  }
}

// Usage
setTheme('ocean')
```

## Integration Examples

### Integration with External APIs

```javascript
// Sync with backend API
async function syncWithServer() {
  try {
    const response = await fetch('https://api.example.com/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(app.tasks)
    })
    const data = await response.json()
    console.log('Synced successfully:', data)
  } catch (error) {
    console.error('Sync failed:', error)
  }
}

// Periodic sync
setInterval(syncWithServer, 60000) // Every minute
```

### Calendar Integration

```javascript
// Get tasks by date
function getTasksByDate(date) {
  return app.tasks.filter((t) => {
    const taskDate = new Date(t.createdAt).toDateString()
    const queryDate = new Date(date).toDateString()
    return taskDate === queryDate
  })
}

// Usage
const todaysTasks = getTasksByDate(new Date())
console.log('Tasks created today:', todaysTasks)
```

### Analytics

```javascript
// Generate analytics report
function generateReport() {
  const stats = app.getStats()
  const oldestTask = app.tasks.reduce((oldest, current) =>
    new Date(current.createdAt) < new Date(oldest.createdAt) ? current : oldest
  )
  const newestTask = app.tasks.reduce((newest, current) =>
    new Date(current.createdAt) > new Date(newest.createdAt) ? current : newest
  )

  return {
    ...stats,
    oldestTaskDate: oldestTask?.createdAt,
    newestTaskDate: newestTask?.createdAt,
    averageTasksPerDay:
      stats.total /
      ((new Date() - new Date(oldestTask?.createdAt || new Date())) / (1000 * 60 * 60 * 24)),
    storageUsed: (new Blob([localStorage.todoAppTasks]).size / 1024).toFixed(2) + ' KB'
  }
}

// Usage
console.table(generateReport())
```

### Notifications

```javascript
// Add browser notifications for overdue tasks
function checkForOverdueTasks() {
  if ('Notification' in window && Notification.permission === 'granted') {
    const overdue = app.tasks.filter(
      (t) => t.dueDate && new Date(t.dueDate) < new Date() && !t.completed
    )

    if (overdue.length > 0) {
      new Notification('Overdue Tasks!', {
        body: `You have ${overdue.length} overdue task(s)`,
        icon: '📝'
      })
    }
  }
}

// Request permission and check periodically
if ('Notification' in window && Notification.permission === 'default') {
  Notification.requestPermission().then(() => {
    setInterval(checkForOverdueTasks, 60000) // Every minute
  })
}
```

---

**Remember**: Always test modifications in the browser console first before adding them to production code!
