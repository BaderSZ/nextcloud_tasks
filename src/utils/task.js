/**
 * @copyright Copyright (c) 2019 Georg Ehrke
 *
 * @author Georg Ehrke <oc.list@georgehrke.com>
 *
 * @copyright Copyright (c) 2022 Bader Zaidan
 *
 * @author Bader Zaidan <bader@zaidan.pw>
 *
 * @license AGPL-3.0-or-later
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 *
 */

import { CalendarComponent, ToDoComponent } from '@nextcloud/calendar-js'

import {
	// mapRecurrenceRuleValueToRecurrenceRuleObject,
	getDefaultRecurrenceRuleObject,
} from '../models/recurrenceRule.js'

/**
 * Creates a complete TaskObject based on given props
 * Based off of '@nextcloud/calendar/src/models/calendarObject.js'
 *
 * @param {object} props The props already provided
 * @return {object}
 */
const getDefaultTaskObject = (props = {}) => Object.assign({}, {
	// The real task-component coming from calendar-js
	toDoComponent: null,
	// Unique ID of the task
	_uid: '',
	// Title/Summary of the task
	_summary: '',
	// Priority of the task
	_priority: 0,
	// Time when dask was completed
	_complete: 0,
	// True if status is complete
	_completed: false,
	// Notes of the task
	_note: null,
	// Duration of the task
	_duration: null,
	// Date when task was completed
	_completedDate: null,
	// Status of the task: NEEDS-ACTION, CONFIRMED, IN-PROGRESS, CANCELLED
	_status: null,
	// Relative of Task
	_related: null,
	// hide subtasks
	_hideSubtasks: false,
	// Hide completed subtasks
	_hideCompletedSubtasks: true,
	// Start date of the task
	_startDate: null,
	// Due date date of the task
	_due: null,
	// Is an all-day Task
	_isAllDay: false,
	// Has task been loaded?
	_loaded: false,
	// Tags of the task
	_tags: [],
	// Date Last Modified
	_modified: null,
	// Date created
	_created: null,
	// Access class of task
	_class: null,
	// Is task pinned?
	_pinned: false,
	// sort Order of task
	_sortOrder: 1,
	// search query
	_searchQuery: '',
	// matches search status
	_matchesSearchQuery: true,
	// is Master Item of recurring
	_isMasterItem: false,
	// location of task
	_location: null,
	// is modifiable?
	_canModifyAllDay: null,
	// recurrence rule of task
	_recurrenceRule: getDefaultRecurrenceRuleObject(),
	// is task recurring
	_isRecurring: null,
	// is task an exception?
	_isRecurrenceException: null,
	// can create exception?
	_canCreateRecurrenceException: null,
})

/**
 * Extracts the first object from the calendar-component
 *
 * @param  {CalendarComponent} calendarComponent The calendar-component
 * @return {any} First VEvent / VJournal / VTodo / VFreeBusy
 */

const getFirstTodoFromCalendarComponent = (calendarComponent) => {
	const vObjectIterator = calendarComponent.getTodoIterator()
	const firstVObject = vObjectIterator.next().value
	if (firstVObject) {
		return firstVObject
	} else {
		return new ToDoComponent()
	}
}
/**
 * Maps a calendar-js ToDoComponent to a TaskObject
 *
 * @param {ToDoComponent} toDoComponent calendar-js toDoComponent
 * @return {object} Task Object
 */
const mapToDoComponentToTaskObject = (toDoComponent) => {
	const toDoObject = getDefaultTaskObject({

		toDoComponent: getDefaultTaskObject(),
		_uid: toDoComponent.uid || '',
		_summary: toDoComponent.title || '',
		_priority: toDoComponent.priority || 0,
		_complete: toDoComponent.percent || 0,
		_completed: toDoComponent.completed,
		_note: toDoComponent.description || null,
		_duration: toDoComponent.duration || null,
		_completedDate: toDoComponent.getFirstPropertyFirstValue('completed') || null,
		_status: toDoComponent.status,
		_related: toDoComponent.getRelationList()[0] !== undefined && toDoComponent.getRelationList()[0].relationType === 'PARENT' ? toDoComponent.getRelationList()[0].relatedId : null,
		_hideSubtasks: toDoComponent.getFirstPropertyFirstValue('x-oc-hidesubtasks') || 0,
		_hideCompletedSubtasks: toDoComponent.getFirstPropertyFirstValue('x-oc-hidecompletedsubtasks') || 0,
		_startDate: toDoComponent.getFirstPropertyFirstValue('dtstart'),
		_due: toDoComponent.getFirstPropertyFirstValue('due'),
		_isAllDay: toDoComponent.isAllDay(),
		_loaded: false,
		_tags: [], // TODO
		_modified: toDoComponent.getFirstPropertyFirstValue('last-modified'),
		_created: toDoComponent.creationTime,
		_class: toDoComponent._class,
		_pinned: toDoComponent.getFirstPropertyFirstValue('x-pinned') === 'true',
		_sortOrder: 1, // TODO
		_searchQuery: '',
		_matchesSearchQuery: true,
		_isMasterItem: toDoComponent.isMasterItem(),
		_location: toDoComponent.location,
		_canModifyAllDay: toDoComponent.canModifyAllDay(),
		_recurrenceRule: null, // TODO
		_isRecurring: toDoComponent.isRecurring(),
		_isRecurrenceException: toDoComponent.isRecurrenceException(),
		_canCreateRecurrenceException: toDoComponent.canCreateRecurrenceExceptions(),
	})

	/**
	 * According to RFC5545, DTEND is exclusive. This is rather intuitive for timed-tasks
	 * but rather unintuitive for all-day tasks
	 *
	 * That's why, when a task is all-day from 2019-10-03 to 2019-10-04,
	 * it will be displayed as 2019-10-03 to 2019-10-03 in the editor.
	 */

	// toDoObject.timeZoneId = toDoComponent.startDate.timezoneId
	// toDoObject.startDate = toDoComponent.startDate

	// if (toDoComponent.isAllDay() && !toDoComponent.endDate) {
	// const endDate = toDoComponent.endDate.clone()
	// endDate.addDuration(DurationValue.fromSeconds(-1 * 60 * 60 * 24))
	// toDoObject.endDate = (endDate)
	// } else {
	// toDoObject.endDate = (toDoComponent.endDate)
	// }

	// toDoObject.dueTime = toDoComponent.dueTime
	// toDoObject.completedTime = toDoComponent.completedTime

	/**
	 * Extract organizers
	 */
	// if (toDoComponent.organizer) {
	// const organizerProperty = toDoComponent.getFirstProperty('ORGANIZER')

	// toDoObject.organizer = {
	// commonName: organizerProperty.commonName,
	// uri: organizerProperty.email,
	// attendeeProperty: organizerProperty,
	// }
	// }

	/**
	 * Extract attendees
	 */
	// for (const attendee of toDoComponent.getAttendeeIterator()) {
	// toDoObject.attendees.push(mapAttendeePropertyToAttendeeObject(attendee))
	// }

	/**
	 * Extract recurrence-rule
	 */
	// const recurrenceRuleIterator = toDoComponent.getPropertyIterator('RRULE')
	// const recurrenceRuleFirstIteration = recurrenceRuleIterator.next()

	// const firstRecurrenceRule = recurrenceRuleFirstIteration.value
	// if (firstRecurrenceRule) {
	// toDoObject.recurrenceRule = mapRecurrenceRuleValueToRecurrenceRuleObject(firstRecurrenceRule.getFirstValue(), toDoComponent.startDate)
	// toDoObject.hasMultipleRRules = !recurrenceRuleIterator.next().done
	// }

	return toDoObject
}

export { CalendarComponent, getDefaultTaskObject, getFirstTodoFromCalendarComponent, mapToDoComponentToTaskObject }