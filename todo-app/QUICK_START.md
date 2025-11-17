# Quick Start Guide

Get up and running with the Todo Task Manager in minutes!

## 30-Second Setup

1. **Open** `index.html` in your web browser
2. **Type** a task in the input field
3. **Press** Enter or click "Add"
4. **Done!** Your tasks are automatically saved

## First 5 Minutes

### Try These Actions:

1. **Add Some Tasks**

   - Type: "Buy groceries"
   - Press: Enter
   - Type: "Write report"
   - Press: Enter

2. **Complete a Task**

   - Click the checkbox next to "Buy groceries"
   - Watch it get crossed out

3. **Delete a Task**

   - Click the trash icon next to any task
   - Watch it disappear with animation

4. **Filter Tasks**

   - Click "Active" to see only incomplete tasks
   - Click "Completed" to see finished tasks
   - Click "All Tasks" to see everything

5. **Check Your Progress**
   - Look at the stat cards at the top
   - See Total, Completed, and Remaining counts

## Common Tasks

### Adding a Task

```
Input: "Buy milk"
Action: Press Enter or click "Add"
Result: Task appears at the top of the list
```

### Marking as Done

```
Action: Click the checkbox next to task
Result: Checkmark appears, text gets crossed out
```

### Deleting a Task

```
Action: Click the trash (🗑️) icon
Result: Task disappears with smooth animation
```

### Clearing Completed Tasks

```
Action: Click "Clear Completed" button
Result: All completed tasks are removed
```

### Filtering by Status

```
All Tasks: Shows everything
Active: Shows only incomplete tasks
Completed: Shows only finished tasks
```

## Keyboard Shortcuts

| Key   | Action                            |
| ----- | --------------------------------- |
| Enter | Add the current task              |
| Tab   | Move between interactive elements |

## Tips for Productivity

1. **Use Present Tense**: "Buy milk" instead of "Bought milk"
2. **Be Specific**: "Fix login bug in auth module" instead of "Fix bug"
3. **One Task Per Item**: Avoid "Buy milk and eggs and bread"
4. **Clear Completed Regularly**: Keep your list focused
5. **Quick Add**: Use Enter key for fast task creation

## Understanding the Interface

```
┌─────────────────────────────────┐
│      📝 My Tasks Header         │  ← Main title
├─────────────────────────────────┤
│ Total: 5  Completed: 2  Active: 3 │  ← Stats cards
├─────────────────────────────────┤
│ [Input field]        [Add]      │  ← Add new tasks
├─────────────────────────────────┤
│ [All] [Active] [Completed]      │  ← Filter buttons
│                   [Clear Done]  │
├─────────────────────────────────┤
│ ☐ Buy groceries          🗑️    │  ← Task item
│ ☑ Write report (done)    🗑️    │  ← Completed task
│ ☐ Call dentist           🗑️    │  ← Another task
├─────────────────────────────────┤
│  Footer with tips               │
└─────────────────────────────────┘
```

## Symbols Explained

| Symbol | Meaning                       |
| ------ | ----------------------------- |
| ☐      | Uncompleted task (checkbox)   |
| ☑     | Completed task (checkmark)    |
| 🗑️     | Delete button                 |
| ◉      | Selected filter               |
| ○      | Unselected filter             |
| ✓      | Checkmark in completed filter |
| 🎯     | Empty state icon              |

## Data is Saved Automatically

- Every action (add, delete, complete) saves to your browser
- Your tasks persist even after closing the browser
- No internet required - everything is local
- Data stored in browser's localStorage

## Mobile Tips

- Tasks look great on phones and tablets
- Touch-friendly buttons and checkboxes
- Responsive design adapts to screen size
- Press and hold for precise interactions

## Frequently Asked Questions

### Q: Will my tasks be deleted if I clear my browser cache?

**A:** Yes. Your tasks are stored in browser's localStorage, which gets cleared with cache.

### Q: Can I access tasks on different devices?

**A:** No, tasks are only stored locally. Use Export feature to transfer between devices.

### Q: How many tasks can I add?

**A:** Technically thousands! Browser storage is ~5-10MB per domain. Current app uses ~0.1KB per task.

### Q: Is my data secure?

**A:** Yes, everything stays on your device. No data is sent to servers.

### Q: Can I share my task list?

**A:** Yes, use the export feature to download as JSON, then share the file.

## Advanced Features (Optional)

These features are available through browser console if you want to explore:

### Export Tasks

```javascript
window.todoApp.exportTasks()
```

### Search Tasks

```javascript
window.todoApp.searchTasks('buy')
```

### Get Statistics

```javascript
window.todoApp.getStats()
```

### Clear Everything

```javascript
window.todoApp.clearAllTasks()
```

## Customization

### Change Theme Colors

Edit `styles.css` and look for:

```css
:root {
  --primary-color: #6366f1; /* Change this color */
}
```

### Change Storage Location

Advanced users can modify the `storageKey` in `script.js`.

## Troubleshooting

### Tasks Not Appearing?

1. Refresh the page
2. Check console (F12) for errors
3. Ensure JavaScript is enabled

### Tasks Disappeared?

1. Check browser console for errors
2. Try importing a backup if you have one
3. Check if localStorage is enabled

### App Not Loading?

1. Check all three files exist: index.html, styles.css, script.js
2. Open browser console (F12) for errors
3. Try a different browser
4. Clear browser cache and reload

## Next Steps

1. ✓ Add 5-10 tasks to get started
2. ✓ Mark a few as complete
3. ✓ Try different filters
4. ✓ Experiment with delete and clear
5. ✓ Check the stats to track progress

## Want to Learn More?

- Read `README.md` for complete documentation
- Check `ADVANCED_USAGE.md` for programming examples
- Inspect browser DevTools (F12) to see data storage
- Review `script.js` to understand how it works

## Browser Console Access

Press `F12` to open Developer Tools, then click "Console" to access:

```javascript
// Access the app
window.todoApp

// View all tasks
console.table(window.todoApp.tasks)

// View current stats
console.log(window.todoApp.getStats())
```

## Getting Help

If something doesn't work:

1. Check browser console for error messages (F12)
2. Ensure you're using a modern browser
3. Try disabling browser extensions
4. Clear browser cache and reload
5. Try in a private/incognito window

---

**Enjoy organizing your tasks!**

Start with the simple interface and explore advanced features as you become more comfortable with the app.
