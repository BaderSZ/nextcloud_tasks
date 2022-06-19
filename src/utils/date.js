/**
 * @copyright Copyright (c) 2019 Georg Ehrke
 *
 * @author Georg Ehrke <oc.list@georgehrke.com>
 *
 * @license AGPL-3.0-or-later
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 *
 */

import { DateTimeValue } from '@nextcloud/calendar-js'
import moment from '@nextcloud/moment'

/**
 * returns a new Date object
 *
 * @return {Date}
 */
export function dateFactory() {
	return new Date()
}

/**
 * formats a Date object as YYYYMMDD
 *
 * @param {Date} date Date to format
 * @return {string}
 */
export function getYYYYMMDDFromDate(date) {
	return new Date(date.getTime() - (date.getTimezoneOffset() * 60000))
		.toISOString()
		.split('T')[0]
}

/**
 * get unix time from date object
 *
 * @param {Date} date Date to format
 * @return {number}
 */
export function getUnixTimestampFromDate(date) {
	return Math.floor(date.getTime() / 1000)
}

/**
 * Gets a date object based on the given DateTimeValue
 * Ignores given timezone-information
 *
 * @param {DateTimeValue} dateTimeValue Value to get date from
 * @return {Date}
 */
export function getDateFromDateTimeValue(dateTimeValue) {
	return new Date(
		dateTimeValue.year,
		dateTimeValue.month - 1,
		dateTimeValue.day,
		dateTimeValue.hour,
		dateTimeValue.minute,
		dateTimeValue.second,
		0,
	)
}

/**
 * Return Moment from DateTimeValue
 *
 * @param {DateTimeValue} dateTimeValue date of object
 * @return {string}
 */
export function getMomentFromDateTimeValue(dateTimeValue) {
	const jsDate = dateTimeValue?.jsDate
	return moment(jsDate, 'YYYYMMDDTHHmmss')
}
