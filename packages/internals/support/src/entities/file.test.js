/* eslint no-unused-expressions: "off" */
const fs = require('fs');
const path = require('path');
const Vinyl = require('vinyl');
const {get} = require('lodash');
const {expect, sinon} = require('../../../../../test/helpers');
const File = require('./file');

const fileContents = 'var x = 123';
const stat = fs.statSync('.');
const baseFileData = {
  cwd: '/',
  base: 'test/',
  path: 'test/file.js',
  contents: new Buffer(fileContents)
};
const makeFile = input => new File(input || baseFileData);

describe('File', function () {
  describe('constructor', function () {
    it('returns a new instance', function () {
      const file = makeFile();
      expect(file).to.exist;
      expect(file instanceof File).to.be.true;
    });
  });
  describe('.set()/get()', function () {
    it('sets and gets a value on the private data store', function () {
      const file = makeFile();
      file.set('foo', 'bar');
      expect(file.foo).to.equal('bar');
      expect(file.get('foo')).to.equal('bar');
    });
    it.only('sets and gets a value on the file reference', function () {
      const file = makeFile();
      file.set('path', 'test/bar.jsx');
      file.set('base', 'components');
      file.dirname = 'components';
      expect(file.relative).to.equal('bar.jsx');
      expect(file.get('path')).to.equal('components/bar.jsx');
      expect(file.get('extname')).to.equal('.jsx');
      file.cwd = '/components';
      expect(file.get('relative')).to.equal('bar.jsx');
      file.set('foo.bar[0]', 'one');
      const cloned = file.clone();
      expect(cloned).to.be.a('File').that.deep.includes(file);
      console.log(get(file, 'path.length'));
    });
    it('sets and gets nested paths', function () {
      const file = makeFile();
      file.set('foo.bar[0]', 'one');
      expect(file.get('foo.bar[0]')).to.equal('one');
      expect(file.get('foo')).to.eql({bar: ['one']});
    });
    it('creates a copy of the original value', function () {
      const file = makeFile();
      const status = {
        tag: 'wip',
        label: 'Work in progress'
      };
      file.set('status', status);
      expect(file.get('status')).to.not.equal(status);
      expect(file.get('status')).to.deep.eql(status);
    });
  });
  describe('.clone()', function () {
    it(`clones a file by deferring to the Vinyl 'clone' method`, function () {
      const spy = sinon.spy(Vinyl.prototype, 'clone');
      const file = makeFile();
      const clonedFile = file.clone();
      expect(spy.calledOnce).to.be.true;
      expect(clonedFile).to.be.a('File').that.deep.includes(file);
    });
    it('retains all the methods of the File class', function () {
      const file = makeFile();
      const clonedFile = file.clone();
      expect(clonedFile instanceof File).to.be.true;
      expect(clonedFile.toJSON).to.be.a('function');
    });
  });
  describe('.toJSON()', function () {
    it(`provides a simple 'JSON.stringify'-able representation of the file`, function () {
      const file = makeFile();
      const jsonedFile = file.toJSON();
      expect(jsonedFile).to.be.an('object');
      expect(jsonedFile).to.eql({
        cwd: '/',
        relative: 'file.js',
        path: 'test/file.js',
        extname: '.js',
        base: 'test',
        basename: 'file.js',
        contents: 'var x = 123',
        dirname: 'test',
        stem: 'file',
        stat: null,
        symlink: null,
        history: ['test/file.js']
      });
    });
    it(`does not output 'hidden' (underscore-prefixed) properties`, function () {
      const file = makeFile({_hidden: 'value', path: '/test/file.js'});
      const jsonedFile = file.toJSON();
      expect(jsonedFile._hidden).to.not.exist;
    });
    it(`does not output fs.Stats properties`, function () {
      const file = makeFile({customStats: stat, path: '/test/file.js'});
      const jsonedFile = file.toJSON();
      expect(jsonedFile.customStats).to.not.exist;
    });

    it(`converts Buffers to their String representation`, function () {
      const fileData = {path: '/test/file.js', contents: Buffer.from('this is a tést')};
      const file = makeFile(fileData);
      const jsonEntity = file.toJSON();
      expect(jsonEntity.contents).to.equal('this is a tést');
    });
  });
  describe('.toString()', function () {
    describe('outputs a String representation of the File if it', function () {
      it('has Buffer contents', function () {
        const file = makeFile();
        expect(file.toString()).to.equal(fileContents);
      });
      it('has empty contents', function () {
        const file = makeFile({path: 'foo.js'});
        expect(file.toString()).to.equal('');
      });
    });
  });
  describe('.isFile()', function () {
    it(`returns true if argument is of type 'File'`, function () {
      const file = makeFile();
      const isFile = File.isFile(file);
      expect(isFile).to.be.true;
    });
    it(`returns false if argument is not of type 'File'`, function () {
      const isFile = File.isFile({});
      expect(isFile).to.be.false;
    });
  });
  describe('.from()', function () {
    it(`creates a new instance of a File`, function () {
      const fileFrom = File.from(baseFileData);
      const file = makeFile();
      expect(fileFrom instanceof File).to.be.true;
      expect(fileFrom).to.be.a('File').that.deep.includes(file);
    });
  });
  describe('.fromPath()', function () {
    it(`creates a new instance of a File from a string 'path' parameter`, async function () {
      const file = await File.fromPath(path.join(__dirname, 'file.js'));
      expect(file instanceof File).to.be.true;
    });
  });
});
