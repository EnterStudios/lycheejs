
lychee.define('lychee.codec.BENCODE').exports(function(lychee, global, attachments) {

	/*
	 * HELPERS
	 */

	const _CHARS_DANGEROUS = /[\u0000\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g;
	const _CHARS_ESCAPABLE = /[\\\"\u0000-\u001f\u007f-\u009f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g;
	const _CHARS_META      = {
		'\b': '\\b',
		'\t': '\\t',
		'\n': '\\n',
		'\f': '\\f',
		'\r': '',    // FUCK YOU, Microsoft!
		'"':  '\\"',
		'\\': '\\\\'
	};

	const _sanitize_string = function(str) {

		let san = str;


		if (_CHARS_ESCAPABLE.test(san)) {

			san = san.replace(_CHARS_ESCAPABLE, function(char) {

				let val = _CHARS_META[char];
				if (typeof val === 'string') {
					return val;
				} else {
					return '\\u' + (char.charCodeAt(0).toString(16)).slice(-4);
				}

			});

		}

		return san;

	};

	const _Stream = function(buffer, mode) {

		this.__buffer = typeof buffer === 'string' ? buffer : '';
		this.__mode   = typeof mode === 'number'   ? mode   : 0;

		this.__index  = 0;

	};


	_Stream.MODE = {
		read:  0,
		write: 1
	};


	_Stream.prototype = {

		toString: function() {
			return this.__buffer;
		},

		pointer: function() {
			return this.__index;
		},

		length: function() {
			return this.__buffer.length;
		},

		seek: function(array) {

			let bytes = Infinity;

			for (let a = 0, al = array.length; a < al; a++) {

				let token = array[a];
				let size  = this.__buffer.indexOf(token, this.__index + 1) - this.__index;
				if (size > -1 && size < bytes) {
					bytes = size;
				}

			}


			if (bytes === Infinity) {
				return 0;
			}


			return bytes;

		},

		seekRAW: function(bytes) {
			return this.__buffer.substr(this.__index, bytes);
		},

		readRAW: function(bytes) {

			let buffer = '';

			buffer       += this.__buffer.substr(this.__index, bytes);
			this.__index += bytes;

			return buffer;

		},

		writeRAW: function(buffer) {

			this.__buffer += buffer;
			this.__index  += buffer.length;

		}

	};



	/*
	 * ENCODER and DECODER
	 */

	const _encode = function(stream, data) {

		// bne, bfe, bte : null, false, true
		if (typeof data === 'boolean' || data === null) {

			if (data === null) {
				stream.writeRAW('bne');
			} else if (data === false) {
				stream.writeRAW('bfe');
			} else if (data === true) {
				stream.writeRAW('bte');
			}


		// i123e : Integer or Float (converted as Integer)
		} else if (typeof data === 'number') {

			let hi = (data / 0x80000000) << 0;
			let lo = (data % 0x80000000) << 0;

			stream.writeRAW('i');
			stream.writeRAW('' + (hi * 0x80000000 + lo).toString());
			stream.writeRAW('e');


		// <length>:<contents> : String
		} else if (typeof data === 'string') {

			data = _sanitize_string(data);


			stream.writeRAW(data.length + ':' + data);


		// l<contents>e : Array
		} else if (data instanceof Array) {

			stream.writeRAW('l');

			for (let d = 0, dl = data.length; d < dl; d++) {
				_encode(stream, data[d]);
			}

			stream.writeRAW('e');


		// d<contents>e : Object
		} else if (data instanceof Object && typeof data.serialize !== 'function') {

			stream.writeRAW('d');

			let keys = Object.keys(data).sort(function(a, b) {
				if (a > b) return  1;
				if (a < b) return -1;
				return 0;
			});

			for (let k = 0, kl = keys.length; k < kl; k++) {

				let key = keys[k];

				_encode(stream, key);
				_encode(stream, data[key]);

			}

			stream.writeRAW('e');


		// s<contents>e : Custom High-Level Implementation
		} else if (data instanceof Object && typeof data.serialize === 'function') {

			stream.writeRAW('s');

			let blob = lychee.serialize(data);

			_encode(stream, blob);

			stream.writeRAW('e');

		}

	};

	const _is_decodable_value = function(str) {

		let head = str.charAt(0);
		if (/([bilds]+)/g.test(head)) {
			return true;
		} else if (!isNaN(parseInt(head, 10))) {
			return true;
		}

		return false;

	};

	const _decode = function(stream) {

		let value  = undefined;
		let size   = 0;
		let tmp    = 0;
		let errors = 0;
		let check  = null;


		if (stream.pointer() < stream.length()) {

			let seek = stream.seekRAW(1);


			// bne, bfe, bte : null, false, true
			if (seek === 'b') {

				if (stream.seekRAW(3) === 'bne') {
					stream.readRAW(3);
					value = null;
				} else if (stream.seekRAW(3) === 'bfe') {
					stream.readRAW(3);
					value = false;
				} else if (stream.seekRAW(3) === 'bte') {
					stream.readRAW(3);
					value = true;
				}


			// i123e : Integer or Float (converted as Integer)
			} else if (seek === 'i') {

				stream.readRAW(1);

				size = stream.seek('e');

				if (size > 0) {

					tmp   = stream.readRAW(size);
					value = parseInt(tmp, 10);
					check = stream.readRAW(1);

				}


			// <length>:<contents> : String
			} else if (!isNaN(parseInt(seek, 10))) {

				size = stream.seek(':');

				if (size > 0) {

					size  = parseInt(stream.readRAW(size), 10);
					check = stream.readRAW(1);

					if (!isNaN(size) && check === ':') {
						value = stream.readRAW(size);
					}

				}


			// l<contents>e : Array
			} else if (seek === 'l') {

				value = [];


				stream.readRAW(1);

				while (errors === 0) {

					value.push(_decode(stream));

					check = stream.seekRAW(1);

					if (check === 'e') {
						break;
					} else if (_is_decodable_value(check) === false) {
						errors++;
					}

				}

				stream.readRAW(1);


			// d<contents>e : Object
			} else if (seek === 'd') {

				value = {};


				stream.readRAW(1);

				while (errors === 0) {

					let object_key   = _decode(stream);
					let object_value = _decode(stream);

					check = stream.seekRAW(1);

					value[object_key] = object_value;

					if (check === 'e') {
						break;
					} else if (isNaN(parseInt(check, 10))) {
						errors++;
					}

				}

				stream.readRAW(1);


			// s<contents>e : Custom High-Level Implementation
			} else if (seek === 's') {

				stream.readRAW(1);

				let blob = _decode(stream);

				value = lychee.deserialize(blob);
				check = stream.readRAW(1);

				if (check !== 'e') {
					value = undefined;
				}

			}

		}


		return value;

	};



	/*
	 * IMPLEMENTATION
	 */

	const Module = {

		/*
		 * ENTITY API
		 */

		// deserialize: function(blob) {},

		serialize: function() {

			return {
				'reference': 'lychee.codec.BENCODE',
				'blob':      null
			};

		},



		/*
		 * CUSTOM API
		 */

		encode: function(data) {

			data = data instanceof Object ? data : null;


			if (data !== null) {

				let stream = new _Stream('', _Stream.MODE.write);

				_encode(stream, data);

				return new Buffer(stream.toString(), 'utf8');

			}


			return null;

		},

		decode: function(data) {

			data = data instanceof Buffer ? data : null;


			if (data !== null) {

				let stream = new _Stream(data.toString('utf8'), _Stream.MODE.read);
				let object = _decode(stream);
				if (object !== undefined) {
					return object;
				}

			}


			return null;

		}

	};


	return Module;

});

