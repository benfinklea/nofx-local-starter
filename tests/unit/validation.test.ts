/**
 * Validation and Security Unit Tests
 */

describe('Validation Tests', () => {
  describe('Input Validation', () => {
    test('validates email format', () => {
      const validateEmail = (email: string): boolean => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
      };

      expect(validateEmail('user@example.com')).toBe(true);
      expect(validateEmail('invalid.email')).toBe(false);
      expect(validateEmail('user@')).toBe(false);
      expect(validateEmail('@example.com')).toBe(false);
      expect(validateEmail('')).toBe(false);
    });

    test('validates UUID format', () => {
      const validateUUID = (uuid: string): boolean => {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        return uuidRegex.test(uuid);
      };

      expect(validateUUID('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
      expect(validateUUID('invalid-uuid')).toBe(false);
      expect(validateUUID('123456789')).toBe(false);
      expect(validateUUID('')).toBe(false);
    });

    test('validates JSON structure', () => {
      const validateJSON = (str: string): boolean => {
        try {
          JSON.parse(str);
          return true;
        } catch {
          return false;
        }
      };

      expect(validateJSON('{"valid": "json"}')).toBe(true);
      expect(validateJSON('[1, 2, 3]')).toBe(true);
      expect(validateJSON('invalid json')).toBe(false);
      expect(validateJSON('{invalid}')).toBe(false);
    });

    test('validates required fields', () => {
      const validateRequired = (obj: any, fields: string[]): boolean => {
        return fields.every(field => obj[field] !== undefined && obj[field] !== null);
      };

      const validObj = { name: 'John', age: 30, email: 'john@example.com' };
      const invalidObj = { name: 'John', age: null };

      expect(validateRequired(validObj, ['name', 'age'])).toBe(true);
      expect(validateRequired(invalidObj, ['name', 'age'])).toBe(false);
      expect(validateRequired({}, ['name'])).toBe(false);
    });
  });

  describe('Sanitization', () => {
    test('sanitizes HTML input', () => {
      const sanitizeHTML = (input: string): string => {
        return input
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#x27;')
          .replace(/\//g, '&#x2F;');
      };

      expect(sanitizeHTML('<script>alert("XSS")</script>')).toBe(
        '&lt;script&gt;alert(&quot;XSS&quot;)&lt;&#x2F;script&gt;'
      );
      expect(sanitizeHTML('<img src=x onerror="alert(1)">')).toBe(
        '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;'
      );
    });

    test('sanitizes SQL input', () => {
      const sanitizeSQL = (input: string): string => {
        return input.replace(/['";\\]/g, '');
      };

      expect(sanitizeSQL("'; DROP TABLE users; --")).toBe(' DROP TABLE users --');
      expect(sanitizeSQL("1' OR '1'='1")).toBe('1 OR 1=1');
    });

    test('removes control characters', () => {
      const removeControlChars = (input: string): string => {
        // eslint-disable-next-line no-control-regex
        return input.replace(/[\x00-\x1F\x7F]/g, '');
      };

      expect(removeControlChars('Hello\x00World')).toBe('HelloWorld');
      expect(removeControlChars('Test\nString')).toBe('TestString');
    });

    test('truncates long strings', () => {
      const truncate = (str: string, maxLength: number): string => {
        return str.length > maxLength ? str.slice(0, maxLength) + '...' : str;
      };

      expect(truncate('Short string', 20)).toBe('Short string');
      expect(truncate('This is a very long string', 10)).toBe('This is a ...');
    });
  });

  describe('Type Validation', () => {
    test('validates string type', () => {
      const isString = (value: any): boolean => {
        return typeof value === 'string';
      };

      expect(isString('test')).toBe(true);
      expect(isString(123)).toBe(false);
      expect(isString(null)).toBe(false);
      expect(isString(undefined)).toBe(false);
    });

    test('validates number type', () => {
      const isNumber = (value: any): boolean => {
        return typeof value === 'number' && !isNaN(value);
      };

      expect(isNumber(123)).toBe(true);
      expect(isNumber(12.34)).toBe(true);
      expect(isNumber('123')).toBe(false);
      expect(isNumber(NaN)).toBe(false);
    });

    test('validates array type', () => {
      const isArray = (value: any): boolean => {
        return Array.isArray(value);
      };

      expect(isArray([1, 2, 3])).toBe(true);
      expect(isArray([])).toBe(true);
      expect(isArray('array')).toBe(false);
      expect(isArray({ length: 0 })).toBe(false);
    });

    test('validates object type', () => {
      const isObject = (value: any): boolean => {
        return value !== null && typeof value === 'object' && !Array.isArray(value);
      };

      expect(isObject({ key: 'value' })).toBe(true);
      expect(isObject({})).toBe(true);
      expect(isObject(null)).toBe(false);
      expect(isObject([1, 2, 3])).toBe(false);
    });
  });

  describe('Range Validation', () => {
    test('validates number ranges', () => {
      const inRange = (value: number, min: number, max: number): boolean => {
        return value >= min && value <= max;
      };

      expect(inRange(5, 1, 10)).toBe(true);
      expect(inRange(0, 1, 10)).toBe(false);
      expect(inRange(11, 1, 10)).toBe(false);
    });

    test('validates string length', () => {
      const validateLength = (str: string, min: number, max: number): boolean => {
        return str.length >= min && str.length <= max;
      };

      expect(validateLength('hello', 1, 10)).toBe(true);
      expect(validateLength('', 1, 10)).toBe(false);
      expect(validateLength('very long string', 1, 10)).toBe(false);
    });

    test('validates date ranges', () => {
      const isDateInRange = (date: Date, start: Date, end: Date): boolean => {
        return date >= start && date <= end;
      };

      const now = new Date();
      const yesterday = new Date(now.getTime() - 86400000);
      const tomorrow = new Date(now.getTime() + 86400000);

      expect(isDateInRange(now, yesterday, tomorrow)).toBe(true);
      expect(isDateInRange(yesterday, now, tomorrow)).toBe(false);
    });
  });

  describe('Format Validation', () => {
    test('validates URL format', () => {
      const validateURL = (url: string): boolean => {
        try {
          new URL(url);
          return true;
        } catch {
          return false;
        }
      };

      expect(validateURL('https://example.com')).toBe(true);
      expect(validateURL('http://localhost:3000')).toBe(true);
      expect(validateURL('invalid-url')).toBe(false);
      expect(validateURL('example.com')).toBe(false);
    });

    test('validates phone number format', () => {
      const validatePhone = (phone: string): boolean => {
        const phoneRegex = /^\+?[\d\s-()]+$/;
        return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
      };

      expect(validatePhone('+1 (555) 123-4567')).toBe(true);
      expect(validatePhone('555-123-4567')).toBe(true);
      expect(validatePhone('123')).toBe(false);
      expect(validatePhone('invalid')).toBe(false);
    });

    test('validates date format', () => {
      const validateDate = (dateStr: string): boolean => {
        const date = new Date(dateStr);
        return !isNaN(date.getTime());
      };

      expect(validateDate('2024-01-01')).toBe(true);
      expect(validateDate('01/01/2024')).toBe(true);
      expect(validateDate('invalid-date')).toBe(false);
      expect(validateDate('2024-13-01')).toBe(false);
    });
  });

  describe('Business Rule Validation', () => {
    test('validates password strength', () => {
      const validatePassword = (password: string): boolean => {
        return (
          password.length >= 8 &&
          /[A-Z]/.test(password) &&
          /[a-z]/.test(password) &&
          /[0-9]/.test(password) &&
          /[^A-Za-z0-9]/.test(password)
        );
      };

      expect(validatePassword('Strong@Pass123')).toBe(true);
      expect(validatePassword('weak')).toBe(false);
      expect(validatePassword('NoNumbers!')).toBe(false);
      expect(validatePassword('nouppercas3!')).toBe(false);
    });

    test('validates age restrictions', () => {
      const validateAge = (birthDate: Date, minAge: number): boolean => {
        const today = new Date();
        const age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();

        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          return age - 1 >= minAge;
        }

        return age >= minAge;
      };

      const adult = new Date('2000-01-01');
      const minor = new Date('2010-01-01');

      expect(validateAge(adult, 18)).toBe(true);
      expect(validateAge(minor, 18)).toBe(false);
    });

    test('validates credit card number', () => {
      const validateCreditCard = (cardNumber: string): boolean => {
        const cleaned = cardNumber.replace(/\D/g, '');

        if (cleaned.length < 13 || cleaned.length > 19) {
          return false;
        }

        // Luhn algorithm
        let sum = 0;
        let isEven = false;

        for (let i = cleaned.length - 1; i >= 0; i--) {
          const char = cleaned[i];
          if (!char) continue; // Skip if undefined
          let digit = parseInt(char, 10);

          if (isEven) {
            digit *= 2;
            if (digit > 9) {
              digit -= 9;
            }
          }

          sum += digit;
          isEven = !isEven;
        }

        return sum % 10 === 0;
      };

      expect(validateCreditCard('4532015112830366')).toBe(true);
      expect(validateCreditCard('1234567890123456')).toBe(false);
      expect(validateCreditCard('invalid')).toBe(false);
    });
  });
});