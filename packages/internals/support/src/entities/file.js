const {assert} = require('check-types');
const fs = require('fs');
const cloneStats = require('clone-stats');
const {mapValues, get, pick, pickBy, omit, assign, difference} = require('lodash');
const Vinyl = require('vinyl');
const {promisify, cloneDeep, hash} = require('@frctl/utils');
const schema = require('../../schema');
const Validator = require('../validator');
const Entity = require('./entity');

const pfs = promisify(fs);
const vinylProps = ['contents', 'cwd', 'base', 'path', 'dirname', 'basename', 'stem', 'extname', 'symlink'];
const vinylPropGetters = vinylProps.concat(['history', 'relative', 'stat']);

const _vinylFiles = new WeakMap();

class File extends Entity {

  constructor(props = {}) {
    if (File.isFile(props)) {
      return props;
    }
    // console.log(props);
    File.validate(props);

    const configAttrs = Object.keys(props).filter(Vinyl.isCustomProp);
    const configProps = pick(props, configAttrs);
    const vinylFileProps = omit(props, configAttrs);
    // console.log(configProps, vinylFileProps);

    super(configProps);

    this._setFile(new Vinyl(vinylFileProps));

    return new Proxy(this, {
      get: this._proxyGet,
      set: this._proxySet,
      has: this._proxyHas
    });
  }

  get(path, fallback) {
    let initial, final;
    console.log(path);
    let first = path.split ? (path.split('.')[0]) : path;
    if (vinylPropGetters.indexOf(first) !== -1) {
      initial = cloneDeep(get(_vinylFiles.get(this), path, fallback));
      console.log(initial);
      return this._computeFinalGetter(path, initial);
    } else {
      return super.get(path, fallback);
    }
  }

  set(path, value) {
    assert.string(path, `${this[Symbol.toStringTag]}.set - 'path' argument must be a string [path-invalid]`);

    let initial, final;
    if (vinylPropGetters.indexOf(path) !== -1) {
      const initial = cloneDeep(value);
      const final = this._computeFinalSetter(path, initial);
      _vinylFiles.get(this)[path] = final;
      return final;
    } else {
      return super.set(path, value);
    }
  }

  clone() {
    const vinylFile = _vinylFiles.get(this);
    const clonedVFile = vinylFile.clone({deep: true, path: vinylFile.path});
    const config = this._config;

    let file = new this.constructor(Object.assign(config, {
      cwd: clonedVFile.cwd,
      base: clonedVFile.base,
      path: clonedVFile.path,
      stat: (clonedVFile.stat ? cloneStats(clonedVFile.stat) : null),
      history: clonedVFile.history.slice(),
      contents: clonedVFile.contents
    }));
    return this._addDataEntries(file);
  }

  getComputedProps() {
    return Object.assign({}, super.getComputedProps(), this.toJSON());
  }

  toJSON() {
    const file = _vinylFiles.get(this);
    const vinylProps = pick(file, vinylPropGetters);

    const customProps = pickBy(this, (value, key) => {
      return !key.startsWith('_') && typeof value !== 'function' && !(value instanceof fs.Stats);
    });

    return mapValues(assign(vinylProps, customProps), (item, key, obj) => {
      if (Buffer.isBuffer(item)) {
        return item.toString();
      }
      if (item && typeof item.toJSON === 'function') {
        return item.toJSON();
      }
      return item;
    });
  }

  toString() {
    const file = _vinylFiles.get(this);
    return file.contents ? file.contents.toString() : '';
  }

  get [Symbol.toStringTag]() {
    return 'File';
  }

  _setFile(file) {
    _vinylFiles.set(this, file);
  }

  _proxyHas(target, propKey) {
    console.log(target, propKey, _vinylFiles.get(target));
    if (Reflect.has(_vinylFiles.get(target), propKey)) {
      return true;
    } else {
      return super._proxyHas(target, propKey);
    }
  }

  static isFile(item) {
    return item instanceof File;
  }

  static isVinyl(item) {
    return Vinyl.isVinyl(_vinylFiles.get(item));
  }

  static from(props) {
    return new this(props);
  }

  static validate(props) {
    Validator.assertValid(props, schema.file, `File.constructor: The properties provided do not match the schema of a File [properties-invalid]`);
  }

  static async fromPath(path, opts = {}) {
    const stat = await pfs.stat(path);
    const contents = await pfs.readFile(path);
    const cwd = opts.cwd || process.cwd();
    const base = opts.base || cwd;
    return new File({path, cwd, stat, base, contents});
  }

}

for (let prop of vinylProps) {
  Reflect.defineProperty(File.prototype, prop, {
    get: function () {
      return Reflect.get(_vinylFiles.get(this), prop);
    },
    set: function (value) {
      return Reflect.set(_vinylFiles.get(this), prop, value);
    },
    enumerable: true
  });
}
for (let prop of difference(vinylProps, vinylPropGetters)) {
  Reflect.defineProperty(File.prototype, prop, {
    get: function () {
      return Reflect.get(_vinylFiles.get(this), prop);
    },
    enumerable: true
  });
}
for (let method of ['isSymbolic', 'isDirectory', 'isNull', 'isStream', 'isBuffer']) {
  File.prototype[method] = function (...args) {
    return _vinylFiles.get(this)[method](...args);
  }
}

module.exports = File;
