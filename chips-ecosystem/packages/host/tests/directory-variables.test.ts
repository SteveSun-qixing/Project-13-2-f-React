import { describe, expect, it } from 'vitest';

import { DIRECTORY_VARIABLE_NAMES } from '../src/platform/contracts/index.js';
import { DirectoryVariableError, createDirectoryVariableResolver } from '../src/platform/directory-variables.js';

/** 测试用目录变量映射（全部绝对路径）。 */
function testPaths(): Record<string, string> {
  return {
    userHome: '/Users/tester',
    userDocuments: '/Users/tester/Documents',
    userDownloads: '/Users/tester/Downloads',
    userDesktop: '/Users/tester/Desktop',
    userPictures: '/Users/tester/Pictures',
    userMusic: '/Users/tester/Music',
    userVideos: '/Users/tester/Movies',
    userData: '/Users/tester/Library/Application Support/Chips',
    temp: '/var/folders/chips-test',
  };
}

describe('createDirectoryVariableResolver', () => {
  it('should reject a missing directory variable', () => {
    const paths = testPaths();
    delete paths['temp'];
    expect(() => createDirectoryVariableResolver(paths)).toThrow(DirectoryVariableError);
    try {
      createDirectoryVariableResolver(paths);
    } catch (error) {
      expect(error).toBeInstanceOf(DirectoryVariableError);
      if (error instanceof DirectoryVariableError) {
        expect(error.code).toBe('PAL_DIRECTORY_VARIABLE_INVALID');
        expect(error.details).toMatchObject({ variable: 'temp' });
      }
    }
  });

  it('should reject a non-absolute directory variable value', () => {
    expect(() => createDirectoryVariableResolver({ ...testPaths(), userHome: 'relative/home' })).toThrow(
      DirectoryVariableError,
    );
  });

  it('should expose the normalized variable table', () => {
    const resolver = createDirectoryVariableResolver(testPaths());
    expect(Object.keys(resolver.paths).sort()).toEqual([...DIRECTORY_VARIABLE_NAMES].sort());
    expect(resolver.paths.userDocuments).toBe('/Users/tester/Documents');
  });
});

describe('DirectoryVariableResolver.expand', () => {
  const resolver = createDirectoryVariableResolver(testPaths());

  it('should expand a single variable with a trailing path', () => {
    expect(resolver.expand('${userDocuments}/chips/notes.card')).toBe('/Users/tester/Documents/chips/notes.card');
  });

  it('should expand multiple variables in one path', () => {
    expect(resolver.expand('${userHome}/backup/${userDesktop}')).toBe('/Users/tester/backup//Users/tester/Desktop');
  });

  it('should pass through an already absolute path', () => {
    expect(resolver.expand('/opt/chips/data')).toBe('/opt/chips/data');
  });

  it('should reject an unknown variable', () => {
    expect(() => resolver.expand('${userUnknown}/x')).toThrow(DirectoryVariableError);
    try {
      resolver.expand('${userUnknown}/x');
    } catch (error) {
      if (error instanceof DirectoryVariableError) {
        expect(error.details).toMatchObject({ variable: 'userUnknown' });
      }
    }
  });

  it('should reject malformed or unterminated variable syntax', () => {
    expect(() => resolver.expand('${userDocuments/unclosed')).toThrow(DirectoryVariableError);
    expect(() => resolver.expand('${}/x')).toThrow(DirectoryVariableError);
    expect(() => resolver.expand('${user-home}/x')).toThrow(DirectoryVariableError);
  });

  it('should reject empty input', () => {
    expect(() => resolver.expand('')).toThrow('路径不能为空');
  });

  it('should reject results that are not absolute', () => {
    expect(() => resolver.expand('relative/${userHome}')).toThrow('展开结果不是绝对路径');
  });

  it('should not fold path segments or resolve symlinks', () => {
    expect(resolver.expand('${userDocuments}/../secrets')).toBe('/Users/tester/Documents/../secrets');
  });
});
