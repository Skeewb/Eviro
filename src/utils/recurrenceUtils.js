// Utility functions for handling recurring tasks

// Parse a date string (YYYY-MM-DD) without timezone issues
const parseLocalDate = (dateStr) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date;
};

// Format a Date object back to YYYY-MM-DD string
const formatLocalDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getRecurringTaskInstances = (task, startDate, endDate) => {
  // If task has no recurrence, return empty array
  if (!task.recurrence || task.recurrence === 'none' || !task.dueDate) {
    return [];
  }

  const instances = [];
  const taskDueDate = parseLocalDate(task.dueDate);
  let currentDate = new Date(taskDueDate);

  // Check if there's a recurrence end date
  const recurrenceEnd = task.recurrenceEnd ? parseLocalDate(task.recurrenceEnd) : null;

  // Generate instances based on recurrence type
  while (currentDate <= endDate) {
    // Stop if we've passed the recurrence end date
    if (recurrenceEnd && currentDate > recurrenceEnd) {
      break;
    }

    // Only add if the date is within the requested range
    if (currentDate >= startDate) {
      instances.push({
        ...task,
        dueDate: formatLocalDate(currentDate),
        isRecurringInstance: true,
        parentId: task.id,
      });
    }

    // Move to next recurrence
    const nextDate = new Date(currentDate);
    switch (task.recurrence) {
      case 'daily':
        nextDate.setDate(nextDate.getDate() + 1);
        break;
      case 'weekly':
        nextDate.setDate(nextDate.getDate() + 7);
        break;
      case 'monthly':
        nextDate.setMonth(nextDate.getMonth() + 1);
        break;
      case 'yearly':
        nextDate.setFullYear(nextDate.getFullYear() + 1);
        break;
      default:
        break;
    }

    currentDate = nextDate;

    // Safety check to prevent infinite loops
    if (instances.length > 1000) {
      console.warn('Too many recurring task instances generated, stopping');
      break;
    }
  }

  return instances;
};

export const getAllTasksWithRecurring = (tasks, startDate, endDate) => {
  const allTasks = [...tasks];

  // Add recurring instances
  tasks.forEach((task) => {
    const instances = getRecurringTaskInstances(task, startDate, endDate);
    allTasks.push(...instances);
  });

  return allTasks;
};
