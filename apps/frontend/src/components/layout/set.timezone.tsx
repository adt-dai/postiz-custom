'use client';
import dayjs, { ConfigType } from 'dayjs';
import { FC, useEffect } from 'react';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import relativeTime from 'dayjs/plugin/relativeTime';
dayjs.extend(timezone);
dayjs.extend(utc);
dayjs.extend(relativeTime);

const { utc: originalUtc } = dayjs;

export const getTimezone = () => {
  if (typeof window === 'undefined') {
    return dayjs.tz.guess();
  }
  return localStorage.getItem('timezone') || dayjs.tz.guess();
};

export const newDayjs = (config?: ConfigType) => {
  return dayjs(config);
};

// Builds a dayjs instance anchored to the user's configured display timezone
// (falls back to the browser's guessed timezone). Use this instead of
// newDayjs()/dayjs() for anything that needs to render or bucket dates
// according to the user's chosen timezone rather than the OS timezone.
export const dayjsTz = (config?: ConfigType) => {
  return dayjs.tz(config, getTimezone());
};

// Converts a known UTC instant (e.g. a post's publishDate coming from the
// backend) into the user's configured display timezone.
export const utcToTz = (config?: ConfigType) => {
  return dayjs.utc(config).tz(getTimezone());
};

const SetTimezone: FC = () => {
  useEffect(() => {
    dayjs.utc = (config?: ConfigType, format?: string, strict?: boolean) => {
      const result = originalUtc(config, format, strict);

      // Attach `.local()` method to the returned Dayjs object
      result.local = function () {
        return result.tz(getTimezone());
      };

      return result;
    };
    if (localStorage.getItem('timezone')) {
      dayjs.tz.setDefault(getTimezone());
    }
  }, []);
  return null;
};

export default SetTimezone;
