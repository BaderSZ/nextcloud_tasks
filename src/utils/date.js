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
import logger from './logger.js'
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
 * Gets a Date-object based on the firstday param used in routes
 *
 * @param {string} firstDayParam The firstday param from the router
 * @return {Date}
 */
export function getDateFromFirstdayParam(firstDayParam) {
	if (firstDayParam === 'now') {
		return dateFactory()
	}

	const [year, month, date] = firstDayParam.split('-')
		.map((str) => parseInt(str, 10))

	if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(date)) {
		logger.error('First day parameter contains non-numerical components, falling back to today')
		return dateFactory()
	}

	const dateObject = dateFactory()
	dateObject.setFullYear(year, month - 1, date)
	dateObject.setHours(0, 0, 0, 0)

	return dateObject
}

/**
 * formats firstday param as YYYYMMDD
 *
 * @param {string} firstDayParam The firstday param from the router
 * @return {string}
 */
export function getYYYYMMDDFromFirstdayParam(firstDayParam) {
	if (firstDayParam === 'now') {
		return getYYYYMMDDFromDate(dateFactory())
	}

	return firstDayParam
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

export { moment }
