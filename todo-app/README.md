# Todo Task Manager

A feature-rich, interactive task management application built with vanilla JavaScript, HTML, and CSS. Perfect for organizing your daily tasks with a clean, modern interface.

## Features

### Core Functionality

- **Add Tasks**: Simple input field with "Add" button (or press Enter)
- **Complete/Incomplete**: Toggle task completion status with checkboxes
- **Delete Tasks**: Remove individual tasks with delete button
- **Filter Options**: View All, Active, or Completed tasks
- **Clear Completed**: Bulk delete all completed tasks
- **Task Counter**: Real-time statistics showing total, completed, and remaining tasks

### Advanced Features

- **Persistent Storage**: All tasks saved to browser's localStorage
- **Responsive Design**: Works beautifully on mobile, tablet, and desktop
- **Smooth Animations**: Elegant transitions and loading effects
- **Empty States**: Helpful messages when there are no tasks
- **Notifications**: Visual feedback for user actions
- **Offline Support**: Service Worker for offline functionality
- **Keyboard Shortcuts**: Press Enter to add tasks quickly
- **Task Validation**: Prevents empty or overly long tasks

## Installation & Setup

### Option 1: Direct File Access

1. Download or clone the repository
2. Open `index.html` in your web browser
3. Start adding tasks!

### Option 2: Local Server (Recommended for Service Worker)

```bash
# Using Python 3
python -m http.server 8000

# Using Python 2
python -m SimpleHTTPServer 8000

# Using Node.js (with http-server package)
npx http-server
```

Then visit `http://localhost:8000` in your browser.

## Usage

### Adding Tasks

1. Type your task in the input field
2. Click the "Add" button or press Enter
3. Task appears at the top of your list

### Managing Tasks

- **Complete a Task**: Click the checkbox next to the task
- **Uncomplete a Task**: Click the checkbox again
- **Delete a Task**: Click the trash icon on the right
- **Clear Completed**: Click "Clear Completed" button to remove all completed tasks

### Filtering Tasks

- **All Tasks**: Shows all tasks (completed and active)
- **Active**: Shows only incomplete tasks
- **Completed**: Shows only completed tasks

### Keyboard Shortcuts

- **Enter**: Add the current task in input field
- **Tab**: Navigate between buttons

## File Structure

```
todo-app/
├── index.html          # HTML structure and markup
├── styles.css          # All styling and responsive design
├── script.js           # JavaScript logic and TodoApp class
├── sw.js              # Service Worker for offline support
└── README.md          # This file
```

## Technologies Used

- **HTML5**: Semantic markup
- **CSS3**: Flexbox, Grid, animations, and media queries
- **JavaScript (ES6+)**: Classes, arrow functions, destructuring
- **LocalStorage API**: Data persistence
- **Service Workers**: Offline functionality
- **CSS Grid & Flexbox**: Responsive layouts

## Browser Support

- Chrome 88+
- Firefox 85+
- Safari 14+
- Edge 88+
- Mobile browsers (iOS Safari 14+, Chrome Mobile)

## Data Structure

Each task is stored as a JSON object:

```javascript
{
    id: 1234567890,              // Timestamp-based unique ID
    text: "Buy groceries",       // Task description
    completed: false,            // Completion status
    createdAt: "2024-01-15T..."  // ISO timestamp
}
```

All tasks are stored in `localStorage` under the key `todoAppTasks`.

## API Reference

The `TodoApp` class provides the following public methods:

### `addTask()`

Adds a new task from the input field.

### `deleteTask(id)`

Deletes a task by its ID.

```javascript
todoApp.deleteTask(1234567890)
```

### `toggleTask(id)`

Toggles the completion status of a task.

```javascript
todoApp.toggleTask(1234567890)
```

### `clearCompleted()`

Removes all completed tasks after confirmation.

### `exportTasks()`

Exports all tasks as a JSON file.

```javascript
todoApp.exportTasks()
```

### `importTasks(file)`

Imports tasks from a JSON file.

```javascript
const fileInput = document.querySelector('input[type="file"]')
fileInput.addEventListener('change', (e) => {
  todoApp.importTasks(e.target.files[0])
})
```

### `clearAllTasks()`

Clears all tasks after confirmation.

```javascript
todoApp.clearAllTasks()
```

### `searchTasks(query)`

Searches tasks by text content.

```javascript
todoApp.searchTasks('buy')
```

### `getStats()`

Returns task statistics.

```javascript
const stats = todoApp.getStats()
console.log(stats)
// Output:
// {
//     total: 10,
//     completed: 3,
//     active: 7,
//     completionRate: 30
// }
```

## Customization

### Changing Colors

Edit the CSS variables in `styles.css`:

```css
:root {
  --primary-color: #6366f1; /* Main color */
  --success-color: #10b981; /* Completed tasks */
  --danger-color: #ef4444; /* Delete button */
  --text-primary: #1f2937; /* Main text */
}
```

### Changing Storage Key

Modify the `storageKey` in `script.js`:

```javascript
this.storageKey = 'myCustomKey'
```

### Adjusting Task Limit

Change the character limit in the `addTask()` method:

```javascript
if (text.length > 1000) {
  // Changed from 500
  // ...
}
```

## Performance Considerations

- **Efficient Rendering**: Only visible tasks are rendered
- **Debounced Storage**: Tasks saved after each action
- **Minimal Dependencies**: No external libraries required
- **Optimized Animations**: Hardware-accelerated CSS transitions
- **Lazy Loading**: Service Worker caches resources on demand

## Accessibility

- Semantic HTML elements
- ARIA labels and roles
- Keyboard navigation support
- High contrast colors (WCAG AA compliant)
- Focus indicators for interactive elements
- Screen reader friendly

## Browser Storage Limits

- Chrome/Edge: ~10MB
- Firefox: ~10MB
- Safari: ~5MB
- Mobile browsers: ~5-10MB

Current app uses ~0.1KB per task (approximately 100,000 tasks before hitting limits on most browsers).

## Troubleshooting

### Tasks Not Saving

1. Check if localStorage is enabled in your browser
2. Clear browser cache and try again
3. Check browser console for errors (F12)

### Animations Not Working

- Ensure CSS files are loaded correctly
- Check browser compatibility (older browsers may not support all animations)

### Service Worker Not Loading

- Service Worker requires HTTPS (except localhost)
- Check browser console for registration errors
- Clear browser cache

### Tasks Disappeared

- Check if you accidentally cleared browser data
- Try accessing the application from the same domain

## Privacy

All data is stored locally on your device. No data is sent to external servers (unless you explicitly export/share).

## License

Free to use and modify for personal or commercial projects.

## Contributing

Feel free to fork, modify, and improve this application!

## Future Enhancements

- [ ] Task categories/tags
- [ ] Task due dates and reminders
- [ ] Task priorities (high, medium, low)
- [ ] Recurring tasks
- [ ] Drag-and-drop reordering
- [ ] Dark mode toggle
- [ ] Cloud sync option
- [ ] Mobile app version
- [ ] Task notes/descriptions
- [ ] Subtasks

## Tips & Tricks

1. **Quick Add**: Press Enter instead of clicking "Add"
2. **Bulk Actions**: Use "Clear Completed" to quickly remove done tasks
3. **Backup**: Export tasks regularly as JSON
4. **Restore**: Import JSON files to restore tasks
5. **Search**: Use the `todoApp.searchTasks()` method in console to find tasks
6. **Stats**: Check `todoApp.getStats()` in console for task statistics
7. **Storage Check**: View `localStorage.todoAppTasks` in browser DevTools

## Support

If you encounter any issues:

1. Check the browser console (F12) for error messages
2. Clear browser cache and reload
3. Try a different browser
4. Check that JavaScript is enabled

---

**Version**: 1.0.0
**Last Updated**: 2025
**Built with**: HTML5, CSS3, Vanilla JavaScript
