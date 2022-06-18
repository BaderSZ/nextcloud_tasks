/**
 * Nextcloud - Tasks
 *
 * @author John Molakvoæ
 *
 * @copyright 2018 John Molakvoæ <skjnldsv@protonmail.com>
 *
 * @author Raimund Schlüßler
 *
 * @copyright 2021 Raimund Schlüßler <raimund.schluessler@mailbox.org>
 *
 * @author Bader Zaidan
 *
 * @copyright 2022 Bader Zaidan <bader@zaidan.pw>
 *
 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the GNU AFFERO GENERAL PUBLIC LICENSE
 * License as published by the Free Software Foundation; either
 * version 3 of the License, or any later version.
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU AFFERO GENERAL PUBLIC LICENSE for more details.
 *
 * You should have received a copy of the GNU Affero General Public
 * License along with this library. If not, see <http://www.gnu.org/licenses/>.
 *
 */

import PQueue from 'p-queue'
import {
	DateTimeValue,
	DurationValue,
	RecurValue,
	getParserManager,
	ICalendarParser,
	Property,
	RelationProperty,
	ToDoComponent,
} from '@nextcloud/calendar-js'

import { dateFactory, getUnixTimestampFromDate, getDateFromDateTimeValue, getMomentFromDateTimeValue } from '../utils/date.js'
import { getFirstTodoFromCalendarComponent, mapToDoComponentToTaskObject } from '../utils/task.js'

import SyncStatus from './syncStatus.js'

/**
 * @class Task
 * @classdesc Wrapper for ToDoComponent
 *
 * @todo throw exceptions
 * @todo value checking and enforcing
 *
 * @see https://datatracker.ietf.org/doc/html/rfc5545#section-3.6.2
 * @see https://github.com/nextcloud/calendar-js/blob/main/src/components/root/toDoComponent.js
 */
export default class Task {

	/**
	 * Creates an instance of Task
	 *
	 * @param {string} vcalendar the vcalendar data as string with proper new lines
	 * @param {object} calendar the calendar which the task belongs to
	 * @memberof Task
	 */
	constructor(vcalendar, calendar) {
		const parserManager = getParserManager()
		const parser = parserManager.getParserForFileType('text/calendar', {
			preserveMethod: true,
		})

		if (typeof vcalendar !== 'string' || vcalendar.length === 0) {
			throw new Error('Invalid vCalendar')
		}

		expect(parser instanceof ICalendarParser).toEqual(true)

		parser.parse(vcalendar)
		const objectIterator = parser.getItemIterator()
		const calendarComponent = objectIterator.next().value
		if (calendarComponent === undefined) {
			throw new Error('No calendar component found')
		}

		/**
		 * A ToDoComponent '@nextcloud/calendar.js'.
		 *
		 * @see https://github.com/nextcloud/calendar-js
		 *
		 * @name Task#toDoComponent
		 * @type {ToDoComponent}
		 */
		this.toDoComponent = getFirstTodoFromCalendarComponent(calendarComponent)

		this.initTodo()

		/**
		 * @type {object}
		 */
		this.calendar = calendar

		/**
		 * @type {object}
		 * @todo
		 */
		this.subTasks = {}

		/**
		 * Used to state a task is not up to date with the server
		 * and cannot be pushed (etag).
		 *
		 * @type {boolean}
		 */
		this.conflict = false

		/**
		 * Task's sync status
		 *
		 * @type {SyncStatus|null}
		 */
		this.syncStatus = null

		/**
		 * Time in seconds before the task is going to be deleted.
		 *
		 * @type {number|null}
		 */
		this.deleteCountdown = null

		/**
		 * Queue for update requests with concurrency 1, because
		 * we only want to allow one request at a time (otherwise
		 * we will run into problems with changed ETags).
		 *
		 * @type {PQueue}
		 */
		this.updateQueue = new PQueue({ concurrency: 1 })
	}

	/**
	 * Initialize task from ToDoComponent object
	 *
	 * @private
	 */
	initTodo() {
		// Define properties, so Vue reacts to changes of them

		/**
		 * The unique ID of the task
		 *
		 * @type {string}
		 */
		this._uid = this.toDoComponent.uid || ''

		/**
		 * The Title/Summary of the task
		 *
		 * @type {string}
		 */
		this._summary = this.toDoComponent.title || ''

		/**
		 * Priority of the task. Acceptable values are between 0 and 9.
		 *
		 * @see https://datatracker.ietf.org/doc/html/rfc5545#section-3.8.1.9
		 *
		 * @type {number} UNDEFINED: 0, HIGH: 1 to 4, MEDIUM: 5, LOW: 6 to 9.
		 */
		this._priority = this.toDoComponent.priority || 0

		/**
		 * Percent-Progress of the task.
		 *
		 * @see https://datatracker.ietf.org/doc/html/rfc5545#section-3.8.1.8
		 *
		 * @type {number} Percent: not started: 0, in-process: 1->99,
		 * complete: 100
		 */
		this._complete = this.toDoComponent.percent || 0

		/**
		 * Completed status of the task. True if status is completed or cancelled.
		 *
		 * @type {boolean}
		 */
		this._completed = this.toDoComponent.completed || this.toDoComponent.getFirstPropertyFirstValue('PERCENT-COMPLETE') === 100

		/**
		 * Task description
		 *
		 * @see https://datatracker.ietf.org/doc/html/rfc5545#section-3.8.1.5
		 *
		 * @type {string|null}
		 */

		this._note = this.toDoComponent.description || null

		/**
		 * Duration of the task
		 *
		 * @type {DurationValue|null}
		 */
		this._duration = this.toDoComponent.duration || null

		/**
		 * Date and time of completion
		 *
		 * @see https://datatracker.ietf.org/doc/html/rfc5545#section-3.8.2.1
		 *
		 * @type {DateTimeValue|null}
		 */
		this._completedDate = this.toDoComponent.getFirstPropertyFirstValue('completed') || null

		/**
		 * @todo
		 */
		this._completedDateMoment = getMomentFromDateTimeValue(this._completedDate) || null

		/**
		 * status of the task. Valid results include:
		 * NEEDS-ACTION, IN-PROCESS, COMPLETED, CANCELLED.
		 *
		 * @see https://datatracker.ietf.org/doc/html/rfc5545#section-3.8.1.11
		 *
		 * @type {string}
		 */
		this._status = this.toDoComponent.status

		/**
		 * Parent relative of the task.
		 *
		 * @see https://datatracker.ietf.org/doc/html/rfc5545#section-3.8.4.5
		 *
		 * @type {string} unique ID of the parent task
		 */
		this._related = this.toDoComponent.getRelationList()[0] !== undefined && this.toDoComponent.getRelationList()[0].relationType === 'PARENT' ? this.toDoComponent.getRelationList()[0].relatedId : null

		/**
		 * Show or hide subtasks of tasks
		 *
		 * @type {boolean|0}
		 */
		this._hideSubtasks = this.toDoComponent.getFirstPropertyFirstValue('x-oc-hidesubtasks') || 0

		/**
		 * Show or hide completed subtasks of task
		 *
		 * @type {boolean|0}
		 */
		this._hideCompletedSubtasks = this.toDoComponent.getFirstPropertyFirstValue('x-oc-hidecompletedsubtasks') || 0

		/**
		 * Start date of task specifing when the task begins
		 *
		 * @see https://datatracker.ietf.org/doc/html/rfc5545#section-3.8.2.4
		 *
		 * @type {DateTimeValue|null}
		 */
		this._startDate = this.toDoComponent.getFirstPropertyFirstValue('dtstart') || null

		/**
		 * Start moment
		 *
		 * @type {moment|null}
		 */
		this._startMoment = getMomentFromDateTimeValue(this._startDate) || null

		/**
		 * Expected due date of the task
		 *
		 * @see https://datatracker.ietf.org/doc/html/rfc5545#section-3.8.2.3
		 *
		 * @type {DateTimeValue|null}
		 */
		this._due = this.toDoComponent.getFirstPropertyFirstValue('due') || null

		/**
		 * If task is all-day
		 *
		 * @type {boolean}
		 */
		this._allDay = this.toDoComponent.isAllDay()

		/**
		 * Due moment
		 *
		 * @todo Currently only saving up to hrs. Minutes and seconds go missing
		 *
		 * @type {moment|null}
		 */
		this._dueMoment = getMomentFromDateTimeValue(this._due) || null

		/**
		 * Is this task all-day?
		 *
		 * @type {boolean|null}
		 */
		this._isAllDay = this.toDoComponent.isAllDay() || null

		/**
		 * Save if this task has been loaded to the calendar or not
		 *
		 * @type {boolean}
		 */
		this._loaded = false

		/**
		 * Categories of the current task.
		 *
		 * @type {string[]}
		 */
		this._tags = this.getTags()

		/**
		 * Date when task was last modified
		 *
		 * @see https://datatracker.ietf.org/doc/html/rfc5545#section-3.8.1.2
		 *
		 * @type {DateTimeValue|null}
		 */
		this._modified = this.toDoComponent.getFirstPropertyFirstValue('last-modified') || null

		/**
		 * Modified moment
		 *
		 * @type {moment}
		 */
		this._modifiedMoment = getMomentFromDateTimeValue(this._modified)

		/**
		 * Date when task was created
		 *
		 * @see https://datatracker.ietf.org/doc/html/rfc5545#section-3.8.7.1
		 *
		 * @type {DateTimeValue}
		 */
		this._created = this.toDoComponent.creationTime

		/**
		 * created moment
		 *
		 * @type {moment}
		 */
		this._createdMoment = getMomentFromDateTimeValue(this._created)

		/**
		 * Classification of the task.
		 *
		 * Values include: "PUBLIC", "PRIVATE", "CONFIDENTIAL", iana-token, x-name
		 *
		 * @see https://datatracker.ietf.org/doc/html/rfc5545#section-3.8.1.3
		 *
		 * @type {string}
		 */
		this._class = this.toDoComponent.getFirstPropertyFirstValue('class') || 'PUBLIC'

		/**
		 * Has the task been pinned?
		 *
		 * @type {boolean}
		 */
		this._pinned = this.toDoComponent.getFirstPropertyFirstValue('x-pinned') === 'true'

		let sortOrder = this.toDoComponent.getFirstPropertyFirstValue('x-apple-sort-order')

		if (sortOrder === null) {
			sortOrder = this.getSortOrder()
		}

		/**
		 * Order/Position of the task (positiven umber)
		 *
		 * @type {number} A positive number
		 */
		this._sortOrder = +sortOrder

		/**
		 * Search query string.
		 *
		 * @type {string}
		 * @todo
		 */

		this._searchQuery = ''

		/**
		 * @type {boolean}
		 * @todo
		 */
		this._matchesSearchQuery = true

		/**
		 * @type {boolean}
		 * @todo
		 */
		this._isMasterItem = this.toDoComponent.isMasterItem()

		/**
		 * Location of this task.
		 *
		 * @see https://tools.ietf.org/html/rfc5545#section-3.8.1.7
		 * @todo
		 *
		 * @type {string|null}
		 */
		this._location = this.toDoComponent.location

		/**
		 * Checks whether it's possible to switch from date-time to date or vise-versa
		 *
		 * @type {boolean}
		 */
		this._canModifyAllDay = this.toDoComponent.canModifyAllDay()

		/**
		 * List of recurrence rules
		 *
		 * @see https://github.com/nextcloud/calendar-js/blob/main/src/values/recurValue.js
		 * @todo Implement @calendar-js/recurrenceRule/RecurValue
		 *
		 * @type {RecurValue[]|null}
		 */
		this._recurrenceRuleList = null

		/**
		 * Checks whether component is recurring or not
		 *
		 * @todo
		 * @type {boolean}
		 */
		this._isRecurring = this.toDoComponent.isRecurring()

		/**
		 * Checks whether component is a recurrence-exception
		 *
		 * @todo
		 * @type {boolean}
		 */
		this._isRecurrenceException = this.toDoComponent.isRecurrenceException()

		/**
		 * Checks whether it's possible to create a recurrence exception for this task
		 *
		 * @todo
		 * @type {boolean}
		 */
		this._canCreateRecurrenceException = this.toDoComponent.canCreateRecurrenceExceptions()
	}

	/**
	 * Update internal data of this task
	 *
	 * @param {jCal} jCal jCal object from ICAL.js
	 * @memberof Task
	 */
	updateTask(jCal) {
		const parserManager = getParserManager()
		const parser = parserManager.getParserForFileType('text/calendar', {
			preserveMethod: true,
			processFreeBusy: true,
		})

		parser.parse(jCal)
		const calendarComponentIterator = parser.getItemIterator()
		const calendarComponent = calendarComponentIterator.next().value

		const object = getFirstTodoFromCalendarComponent(calendarComponent)

		this.toDoComponent = mapToDoComponentToTaskObject(object)
	}

	/**
	 * Update linked calendar of this task
	 *
	 * @param {object} calendar the calendar
	 * @memberof Contact
	 */
	updateCalendar(calendar) {
		this.calendar = calendar
	}

	/** @type {string} */
	get key() {
		return this.uid + '~' + this.calendar.id
	}

	/**
	 * DAV URL of the task
	 *
	 * @type {string}
	 */
	get url() {
		if (this.dav) {
			return this.dav.url
		}
		return ''
	}

	/**
	 * DAV URI of the task
	 *
	 *  @type {string}
	 */
	get uri() {
		if (this.dav) {
			return this.dav.url.slice(this.dav.url.lastIndexOf('/') + 1)
		}
		return ''
	}

	/**
	 * UID of the task
	 *
	 * @type {string}
	 */
	get uid() {
		return this._uid
	}

	/** @type {string} */
	set uid(uid) {
		this.toDoComponent.updatePropertyWithValue('uid', uid)
		this._uid = this.toDoComponent.getFirstPropertyFirstValue('uid') || ''
	}

	/** @type {string} */
	get summary() {
		return this._summary
	}

	/** @type {string} */
	set summary(summary) {
		this.toDoComponent.updatePropertyWithValue('summary', summary)
		this.updateLastModified()
		this._summary = this.toDoComponent.getFirstPropertyFirstValue('summary') || ''
	}

	/** @type {number} */
	get priority() {
		return Number(this._priority)
	}

	/** @type {number} */
	set priority(priority) {
		// TODO: check that priority is >= 0 and <10
		if (priority === null || priority === 0) {
			this.toDoComponent.deleteAllProperties('priority')
		} else {
			this.toDoComponent.updatePropertyWithValue('priority', priority)
		}
		this.updateLastModified()
		this._priority = this.toDoComponent.getFirstPropertyFirstValue('priority') || 0
	}

	/** @type {boolean} */
	get closed() {
		return this._completed || this._status === 'CANCELLED'
	}

	/** @type {number} */
	get complete() {
		return Number(this._complete)
	}

	/** @type {number} */
	set complete(complete) {
		this.setComplete(complete)
		// Make complete a number
		complete = +complete
		if (complete < 100) {
			this.setCompleted(false)
			if (complete === 0) {
				this.setStatus('NEEDS-ACTION')
			} else {
				this.setStatus('IN-PROCESS')
			}
		} else {
			this.setCompleted(true)
			this.setStatus('COMPLETED')
		}
	}

	/**
	 * Set the task progress as complete, percent-progress property to 100.
	 *
	 * @see https://datatracker.ietf.org/doc/html/rfc5545#section-3.8.1.8
	 * @param {number} complete Progress of the task
	 */
	setComplete(complete) {
		if (complete === null || complete === 0) {
			this.toDoComponent.deleteAllProperties('PERCENT-COMPLETE')
		} else {
			this.toDoComponent.updatePropertyWithValue('PERCENT-COMPLETE', complete)
		}
		this.updateLastModified()
		this._complete = this.toDoComponent.getFirstPropertyFirstValue('PERCENT-COMPLETE') || 0
	}

	/** @type {boolean} */
	get completed() {
		return this._completed
	}

	/** @type {boolean} */
	set completed(completed) {
		this.setCompleted(completed)
		if (completed) {
			this.setComplete(100)
			this.setStatus('COMPLETED')
		} else {
			if (this.complete === 100) {
				this.setComplete(99)
				this.setStatus('IN-PROCESS')
			}
		}
	}

	/**
	 * Set the status of the task as completed.
	 *
	 * @param {boolean} completed True if status is complete. False otherwise
	 */
	setCompleted(completed) {
		if (completed) {
			this.toDoComponent.updatePropertyWithValue('completed', dateFactory())
		} else {
			this.toDoComponent.deleteAllProperties('completed')
		}
		this.updateLastModified()
		this._completedDate = this.toDoComponent.getFirstPropertyFirstValue('completed')
		this._completed = !!this._completedDate
	}

	/** @type {DateTimeValue} */
	get completedDate() {
		return this._completedDate
	}

	/** @type {string} */
	get completedDateMoment() {
		return this._completedDateMoment.clone()
	}

	/** @type {string} */
	get status() {
		return this._status
	}

	/** @type {string} */
	set status(status) {
		this.setStatus(status)
		if (status === 'COMPLETED') {
			this.setComplete(100)
			this.setCompleted(true)
		} else if (status === 'IN-PROCESS') {
			this.setCompleted(false)
			if (this.complete === 100) {
				this.setComplete(99)
			} else if (this.complete === 0) {
				this.setComplete(1)
			}
		} else if (status === 'NEEDS-ACTION' || status === null) {
			this.setComplete(0)
			this.setCompleted(false)
		}
	}

	/**
	 * Set the status of the task
	 *
	 * @todo verify status is valid before setting
	 *
	 * @param {string} status from ToDo
	 * @see https://datatracker.ietf.org/doc/html/rfc5545#section-3.8.1.11
	 * @memberof Task
	 */
	setStatus(status) {
		if (status === null) {
			this.toDoComponent.deleteAllProperties('status')
		} else {
			this.toDoComponent.updatePropertyWithValue('status', status)
		}
		this.updateLastModified()
		this._status = this.toDoComponent.getFirstPropertyFirstValue('status')
	}

	/** @type {string} */
	get note() {
		return this._note
	}

	/** @type {string} */
	set note(note) {
		// @todo is this comment still valid? check
		// To avoid inconsistent property parameters (bug #3863 in nextcloud/calendar), delete the property, then recreate
		// this.toDoComponent.deleteAllProperties('description')

		this.toDoComponent.updatePropertyWithValue('description', note)
		this.updateLastModified()
		this._note = this.toDoComponent.getFirstPropertyFirstValue('description') || ''
	}

	/** @type {string} */
	get related() {
		return this._related
	}

	/** @type {string} */
	set related(related) {
		const parent = this.getParent()
		if (parent) {
			if (related) {
				parent.relatedId = related
			} else {
				this.toDoComponent.deleteProperty(parent)
			}
		} else {
			if (related) {
				this.toDoComponent.addProperty(RelationProperty.fromRelTypeAndId('PARENT', related))
			}
		}
		this.updateLastModified()
		this._related = this.getParent()?.relatedId || null
	}

	/**
	 * Returns the first parent of the task.
	 *
	 * @return {string} The first parent of the task
	 */
	getParent() {
		const related = this.toDoComponent.getRelationList()
		// Return only the first parent for now
		return related.find(related => {
			return related.relationType === 'PARENT' || related.relationType === undefined
		})
	}

	/** @type {boolean} */
	get pinned() {
		return this._pinned
	}

	/** @type {boolean} */
	set pinned(pinned) {
		if (pinned === true) {
			this.toDoComponent.updatePropertyWithValue('x-pinned', 'true')
		} else {
			this.toDoComponent.deleteAllProperties('x-pinned')
		}
		this.updateLastModified()
		this._pinned = this.toDoComponent.getFirstPropertyFirstValue('x-pinned') === 'true'
	}

	/** @type {boolean} */
	get hideSubtasks() {
		return this._hideSubtasks
	}

	/** @type {boolean} */
	set hideSubtasks(hide) {
		this.toDoComponent.updatePropertyWithValue('x-oc-hidesubtasks', +hide)
		this.updateLastModified()
		this._hideSubtasks = +this.toDoComponent.getFirstPropertyFirstValue('x-oc-hidesubtasks') || 0
	}

	/** @type {boolean} */
	get hideCompletedSubtasks() {
		return this._hideCompletedSubtasks
	}

	/** @type {boolean} */
	set hideCompletedSubtasks(hide) {
		this.toDoComponent.updatePropertyWithValue('x-oc-hidecompletedsubtasks', +hide)
		this.updateLastModified()
		this._hideCompletedSubtasks = +this.toDoComponent.getFirstPropertyFirstValue('x-oc-hidecompletedsubtasks') || 0
	}

	/** @type {DateTimeValue} */
	get start() {
		return this._startDate
	}

	/** @type {DateTimeValue|string} */
	set start(start) {
		if (start) {
			this.toDoComponent.updatePropertyWithValue('dtstart', start)
		} else {
			this.toDoComponent.deleteAllProperties('dtstart')
		}
		this.updateLastModified()
		this._startDate = this.toDoComponent.getFirstPropertyFirstValue('dtstart')
		this._startMoment = getMomentFromDateTimeValue(this._startDate)
		this._allDay = this.toDoComponent.isAllDay()
	}

	/** @type {string} */
	get startMoment() {
		return this._startMoment?.clone() || getMomentFromDateTimeValue(this._start)
	}

	/** @type {DateTimeValue} */
	get due() {
		return this._due
	}

	/**
	 * @type {DateTimeValue|string}
	 *
	 * @todo fix date<->datetime
	 */
	set due(due) {
		if (due) {
			this.toDoComponent.addPropertyWithValue('due', this._due)
		} else {
			this.toDoComponent.deleteAllProperties('due')
		}
		this.updateLastModified()
		this._due = this.toDoComponent.dueTime
		this._dueMoment = getMomentFromDateTimeValue(this._due)
		this._allDay = this.toDoComponent.isAllDay()
	}

	/** @type {string} */
	get dueMoment() {
		return this._dueMoment
	}

	/** @type {boolean} */
	get allDay() {
		return this.toDoComponent.isAllDay()
	}

	/** @type {boolean} */
	set allDay(allDay) {
		let start = this.toDoComponent.getFirstPropertyFirstValue('dtstart')
		if (start) {
			start.isDate = allDay
			this.toDoComponent.updatePropertyWithValue('dtstart', start)
		}
		let due = this.toDoComponent.getFirstPropertyFirstValue('due')
		if (due) {
			due.isDate = allDay
			this.toDoComponent.updatePropertyWithValue('due', due)
		}
		this.updateLastModified()
		start = this.toDoComponent.getFirstPropertyFirstValue('dtstart')
		due = this.toDoComponent.getFirstPropertyFirstValue('due')
		this._allDay = this.toDoComponent.isAllDay()
	}

	/**
	 * @type {null}
	 * @todo
	 */
	get comments() {
		return null
	}

	/** @type {boolean} */
	get loadedCompleted() {
		return this._loaded
	}

	/** @type {boolean} */
	set loadedCompleted(loadedCompleted) {
		this._loaded = loadedCompleted
	}

	/**
	 * @type {null}
	 * @todo
	 */
	get reminder() {
		return null
	}

	/** @type {string[]} */
	get tags() {
		return this._tags
	}

	/**
	 * Return the tags/categories of the task
	 *
	 * @return {Array<string>}
	 * @readonly
	 * @memberof Task
	 */
	getTags() {
		return Array.from(this.toDoComponent.getCategoryIterator())
	}

	/** @type {string[]} */
	set tags(newTags) {
		if (newTags.length > 0) {
			this.toDoComponent.deleteAllProperties('categories')
			for (const t of newTags) {
				this.toDoComponent.addProperty(new Property('categories', t))
			}
		} else {
			this.toDoComponent.deleteAllProperties('categories')
		}
		this.updateLastModified()
		this._tags = this.getTags()
	}

	/**
	 * Update the last modified date of the task
	 *
	 * @todo check/set dirtiness?
	 */
	updateLastModified() {
		const now = dateFactory()
		this.toDoComponent.updatePropertyWithValue('last-modified', now)
		this.toDoComponent.updatePropertyWithValue('dtstamp', now)
		this._modified = now
		this._modifiedMoment = getMomentFromDateTimeValue(this._modified)
	}

	/** @type {DateTimeValue} */
	get modified() {
		return this._modified.clone()
	}

	/** @type {string} */
	get modifiedMoment() {
		return this._modifiedMoment.clone()
	}

	/** @type {DateTimeValue} */
	get created() {
		return this._created.clone()
	}

	/** @type {DateTimeValue|string} */
	set created(createdDate) {
		if (createdDate !== null) {
			this.toDoComponent.updatePropertyWithValue('created', createdDate)
			this._createdMoment = getMomentFromDateTimeValue(this._created)
		} else {
			this.toDoComponent.updatePropertyWithValue('created', dateFactory())
		}

		this.updateLastModified()
		this._created = this.toDoComponent.getFirstPropertyFirstValue('created')
		// Update the sortorder if necessary
		if (this.toDoComponent.getFirstPropertyFirstValue('x-apple-sort-order') === null) {
			this._sortOrder = this.getSortOrder()
		}
	}

	/** @type {string} */
	get createdMoment() {
		return this._createdMoment.clone()
	}

	/** @type {string} */
	get class() {
		return this._class
	}

	/** @type {string} */
	set class(classification) {
		if (classification) {
			this.toDoComponent.updatePropertyWithValue('class', classification)
		} else {
			this.toDoComponent.deleteAllProperties('class')
		}
		this.updateLastModified()
		this._class = this.toDoComponent.getFirstPropertyFirstValue('class') || 'PUBLIC'
	}

	/** @type {number} */
	get sortOrder() {
		return this._sortOrder
	}

	/** @type {number} */
	set sortOrder(sortOrder) {
		// We expect a number for the sort order.
		sortOrder = parseInt(sortOrder)
		if (isNaN(sortOrder)) {
			this.toDoComponent.deleteAllProperties('x-apple-sort-order')
			// Get the default sort order.
			sortOrder = this.getSortOrder()
		} else {
			this.toDoComponent.updatePropertyWithValue('x-apple-sort-order', sortOrder)
		}
		this.updateLastModified()
		this._sortOrder = sortOrder
	}

	/**
	 * Construct the default value for the sort order
	 * from the created date.
	 *
	 * @return {number} The sort order
	 */
	getSortOrder() {
		if (this._created === null) {
			return 0
		}
		return getUnixTimestampFromDate(getDateFromDateTimeValue(this._created)) - getUnixTimestampFromDate(Date('2001-01-01T00:00:00'))
	}

	/**
	 * Checks if the task matches the search query
	 *
	 * @param {string} searchQuery The search string
	 * @return {boolean} If the task matches
	 */
	matches(searchQuery) {
		// If the search query maches the previous search, we don't have to search again.
		if (this._searchQuery === searchQuery) {
			return this._matchesSearchQuery
		}
		// We cache the current search query for faster future comparison.
		this._searchQuery = searchQuery
		// If the search query is empty, the task matches by default.
		if (!searchQuery) {
			this._matchesSearchQuery = true
			return this._matchesSearchQuery
		}
		// We search in these task properties
		const keys = ['summary', 'note', 'tags']
		// Make search case-insensitive.
		searchQuery = searchQuery.toLowerCase()
		for (const key of keys) {
			// For the tags search the array
			if (key === 'tags') {
				for (const tag of this[key]) {
					if (tag.toLowerCase().indexOf(searchQuery) > -1) {
						this._matchesSearchQuery = true
						return this._matchesSearchQuery
					}
				}
			} else {
				if (this[key].toLowerCase().indexOf(searchQuery) > -1) {
					this._matchesSearchQuery = true
					return this._matchesSearchQuery
				}
			}
		}
		this._matchesSearchQuery = false
		return this._matchesSearchQuery
	}

}
