
lychee.define('strainer.api.Composite').requires([
	'strainer.api.PARSER'
]).exports(function(lychee, global, attachments) {

	const _PARSER = lychee.import('strainer.api.PARSER');



	/*
	 * CACHES
	 */

	const _SERIALIZE = {
		body:       'function() { return {}; }',
		hash:       _PARSER.hash('function() { return {}; }'),
		parameters: [],
		values:     [{
			type: 'SerializationBlob',
			value: {
				'constructor': null,
				'arguments':   [],
				'blob':        null
			}
		}]
	};

	const _DESERIALIZE = {
		body: 'function(blob) {}',
		hash: _PARSER.hash('function(blob) {}'),
		parameters: [{
			name:  'blob',
			type:  'SerializationBlob',
			value: {}
		}],
		values: [{
			type:  'undefined',
			value: undefined
		}]
	};



	/*
	 * HELPERS
	 */

	const _find_memory = function(key, stream) {

		let str1 = 'const ' + key + ' = ';
		let str2 = '\n\t};';

		let i1 = stream.indexOf(str1);
		let i2 = stream.indexOf(str2, i1);

		if (i1 !== -1 && i2 !== -1) {
			return stream.substr(i1 + str1.length, i2 - i1 - str1.length + str2.length).trim();
		}

		return 'undefined';

	};

	const _parse_memory = function(memory, stream, errors) {

		let i1 = stream.indexOf('.exports(function(lychee, global, attachments) {');
		let i2 = stream.indexOf('\n\tlet Composite =');

		if (i1 !== -1 && i2 !== -1) {

			let body = stream.substr(i1 + 48, i2 - i1 - 48).trim();
			if (body.length > 0) {

				body.split('\n')
					.map(function(line) {
						return line.trim();
					}).filter(function(line) {
						return line.startsWith('const ');
					}).forEach(function(line) {

						let tmp = line.substr(6).trim();
						let i1  = tmp.indexOf('=');
						if (i1 !== -1) {

							let key   = tmp.substr(0, i1).trim();
							let chunk = tmp.substr(i1 + 1).trim();

							if (key !== '' && chunk !== '') {

								if (chunk.startsWith('function(')) {

									chunk = _find_memory(key, stream);

									if (chunk.endsWith(';')) {
										chunk = chunk.substr(0, chunk.length - 1);
									}

									memory[key] = {
										body:       chunk,
										hash:       _PARSER.hash(chunk),
										parameters: _PARSER.parameters(chunk),
										values:     _PARSER.values(chunk)
									};

								} else {

									memory[key] = _PARSER.detect(chunk);

								}

							}

						}

					});

			}

		}

	};

	const _parse_constructor = function(constructor, stream) {

		let i1 = stream.indexOf('\n\tlet Composite =');
		let i2 = stream.indexOf('\n\t};', i1);

		if (i1 !== -1 && i2 !== -1) {

			let body = stream.substr(i1 + 18, i2 - i1 - 15).trim();
			if (body.length > 0) {

				constructor.body       = body;
				constructor.hash       = _PARSER.hash(body);
				constructor.parameters = _PARSER.parameters(body);

			}

		}

	};

	const _parse_settings = function(settings, stream) {

		let i1 = stream.indexOf('\n\tlet Composite =');
		let i2 = stream.indexOf('\n\t};', i1);

		if (i1 !== -1 && i2 !== -1) {

			let body = stream.substr(i1 + 18, i2 - i1 - 15).trim();
			if (body.length > 0) {

				let object = _PARSER.settings(body);
				if (Object.keys(object).length > 0) {

					for (let o in object) {
						settings[o] = object[o];
					}

				}

			}

		}

	};

	const _parse_properties = function(properties, stream) {

		let i1 = stream.indexOf('\n\tlet Composite =');
		let i2 = stream.indexOf('\n\t};', i1);

		if (i1 !== -1 && i2 !== -1) {

			stream.substr(i1, i2 - i1 + 4).split('\n').forEach(function(line, l) {

				let tmp1 = line.trim();
				if (tmp1.startsWith('this.') && tmp1.includes('=')) {

					let tmp2 = tmp1.split(/this\.([a-z]+)([\s]+)=([\s]+)(.*);/g);
					if (tmp2.pop() === '') {
						// properties['alpha'] = { type: 'Number', value: 1 }
						properties[tmp2[1]] = _PARSER.detect(tmp2[4]);
					}

				}

			});

		}

	};

	const _parse_enums = function(enums, stream) {

		let i1 = stream.indexOf('\n\t};', stream.indexOf('\n\tlet Composite =')) + 4;
		let i2 = stream.indexOf('\n\tComposite.prototype =', i1);

		if (i1 !== -1 && i2 !== -1) {

			stream.substr(i1, i2 - i1).trim().split('\n')
				.filter(function(line) {

					let tmp = line.trim();
					if (
						tmp === ''
						|| tmp.startsWith('//')
						|| tmp.startsWith('/*')
						|| tmp.startsWith('*/')
						|| tmp.startsWith('*')
					) {
						return false;
					}

					return true;

				})
				.map(function(line) {

					let tmp = line.trim();
					if (tmp.startsWith('Composite.') && tmp.endsWith('= {')) {
						return tmp.split('.').slice(1).join('.');
					} else if (tmp.startsWith('Composite.') && tmp.includes('=')) {
						return tmp.split('.').slice(1).join('.');
					}

					return tmp;

				})
				.join('\n')
				.split(';')
				.filter(function(chunk) {

					let tmp = chunk.trim();
					if (tmp.startsWith('//')) {
						return false;
					}

					return tmp !== '';

				}).map(function(body) {

					let enam = _PARSER.enum(body.trim());
					if (enam.name !== undefined) {

						if (enam.values !== undefined) {
							enums[enam.name] = {
								values: enam.values
							};
						} else if (enam.value !== undefined) {
							enums[enam.name] = {
								value: enam.value
							};
						}

					}

				});

		}

	};

	const _parse_methods = function(methods, stream, errors) {

		let i1 = stream.indexOf('\n\tComposite.prototype = {');
		let i2 = stream.indexOf('\n\t};', i1);

		if (i1 !== -1 && i2 !== -1) {

			stream.substr(i1 + 25, i2 - i1 - 25).trim().split('\n')
				.filter(function(line) {

					let tmp = line.trim();
					if (tmp.startsWith('// deserialize: function(blob) {}')) {

						methods['deserialize'] = Object.assign({}, _DESERIALIZE);
						return false;

					} else if (tmp.startsWith('// serialize: function() {}')) {

						methods['serialize'] = Object.assign({}, _SERIALIZE);
						return false;

					} else if (
						tmp === ''
						|| tmp.startsWith('//')
						|| tmp.startsWith('/*')
						|| tmp.startsWith('*/')
						|| tmp.startsWith('*')
					) {
						return false;
					}

					return true;

				})
				.join('\n')
				.split('\n\t\t}')
				.filter(function(chunk) {
					return chunk.trim() !== '';
				}).map(function(body) {

					if (body.startsWith(',')) {
						body = body.substr(1);
					}

					return (body.trim() + '\n\t\t}');

				}).forEach(function(code) {

					let name = code.split(':')[0].trim();
					if (name !== '') {

						let body = code.split(':').slice(1).join(':').trim();

						methods[name] = {
							body:       body,
							hash:       _PARSER.hash(body),
							parameters: _PARSER.parameters(body),
							values:     _PARSER.values(body)
						};

					}

				});


			let deserialize = methods['deserialize'];
			if (deserialize !== undefined) {
				if (deserialize.parameters.length === 0) deserialize.parameters = lychee.assignunlink([], _DESERIALIZE.parameters);
				if (deserialize.values.length === 0)     deserialize.values     = lychee.assignunlink([], _DESERIALIZE.values);
			}

			let serialize = methods['serialize'];
			if (serialize !== undefined) {
				if (serialize.parameters.length === 0) serialize.parameters = lychee.assignunlink([], _SERIALIZE.parameters);
				if (serialize.values.length === 0)     serialize.values     = lychee.assignunlink([], _SERIALIZE.values);
			}


			for (let mid in methods) {

				let method     = methods[mid];
				let parameters = method.parameters;
				let values     = method.values;

				// TODO: Remove this
				if (stream.includes('lychee.math.')) continue;

				if (parameters.length > 0) {

					let found = parameters.filter(function(other) {
						return other.type === 'undefined' && other.value === undefined;
					}).map(function(other) {
						return other.name;
					});

					if (found.length > 0) {

						if (/^(control|render|update|deserialize|serialize)$/g.test(mid) === false) {

							errors.push({
								ruleId:     'no-parameter-value',
								methodName: mid,
								fileName:   null,
								message:    'Invalid parameter values for "' + found.join('", "') + '" for method "' + mid + '()".'
							});

						}

					}

				}

				if (values.length === 0) {

					if (/^(render|update)$/g.test(mid) === false) {

						errors.push({
							ruleId:     'no-return-value',
							methodName: mid,
							fileName:   null,
							message:    'Invalid return value for method "' + mid + '()".'
						});

					}


					method.values.push({
						type:  'undefined',
						value: undefined
					});

				} else if (values.length > 1) {

					let found = values.find(function(other) {
						return other.type === 'undefined' && other.value === undefined;
					}) || null;

					if (found !== null) {

						errors.push({
							ruleId:     'no-return-value',
							methodName: mid,
							fileName:   null,
							message:    'No valid return values for method "' + mid + '()".'
						});

					}

				}

			}

		}

	};



	/*
	 * IMPLEMENTATION
	 */

	const Module = {

		// deserialize: function(blob) {},

		serialize: function() {

			return {
				'reference': 'strainer.api.Composite',
				'arguments': []
			};

		},

		check: function(asset) {

			let stream = asset.buffer.toString('utf8');
			let errors = [];
			let memory = {};
			let result = {
				constructor: {},
				settings:    {},
				properties:  {},
				enums:       {},
				events:      {},
				methods:     {}
			};


			_parse_memory(memory, stream, errors);
			_parse_constructor(result.constructor, stream, errors);
			_parse_settings(result.settings, stream, errors);
			_parse_properties(result.properties, stream, errors);
			_parse_enums(result.enums, stream, errors);
			_parse_methods(result.methods, stream, errors);


			if (result.constructor.parameters.length === 1) {

				let check = result.constructor.parameters[0];
				if (check.name === 'data' || check.name === 'settings') {

					check.type = 'Object';

				} else if (/^(main|client|remote|server)$/g.test(check.name) === false) {

					errors.push({
						ruleId:     'no-composite',
						methodName: 'constructor',
						fileName:   null,
						message:    'Composite has no "settings" object.'
					});

				}

			}


			for (let p in result.properties) {

				let property = result.properties[p];
				if (property.type === 'undefined') {

					let method = result.methods['set' + p.charAt(0).toUpperCase() + p.substr(1)] || null;
					if (method !== null) {

						let found = method.parameters.find(function(val) {
							return p === val.name;
						});

						if (found !== undefined && found.type !== 'undefined') {
							property.type = found.type;
						}

					}

				}

			}


			for (let p in result.properties) {

				let property = result.properties[p];
				if (property.type === 'undefined' && property.value === undefined) {

					errors.push({
						ruleId:       'no-property-value',
						propertyName: p,
						fileName:     null,
						message:      'Unguessable property "' + p + '".'
					});

				}

			}


			if (result.methods['serialize'] === undefined) {

				errors.push({
					ruleId:     'no-serialize',
					methodName: 'serialize',
					fileName:   null,
					message:    'No "serialize()" method.'
				});

			}

			if (result.methods['deserialize'] === undefined) {

				errors.push({
					ruleId:     'no-deserialize',
					methodName: 'deserialize',
					fileName:   null,
					message:    'No "deserialize()" method.'
				});

			}


			return {
				errors: errors,
				memory: memory,
				result: result
			};

		}

	};


	return Module;

});

