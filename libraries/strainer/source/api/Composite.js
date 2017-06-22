
lychee.define('strainer.api.Composite').requires([
	'strainer.api.PARSER'
]).exports(function(lychee, global, attachments) {

	const _PARSER = lychee.import('strainer.api.PARSER');



	/*
	 * CACHES
	 */

	const _SERIALIZE = {
		body:       'function() { return {}; }',
		chunk:      'function() {',
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
		body:       'function(blob) {}',
		chunk:      'function(blob) {',
		hash:       _PARSER.hash('function(blob) {}'),
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

	const _validate_asset = function(asset) {

		if (asset instanceof Object && typeof asset.serialize === 'function') {
			return true;
		}

		return false;

	};

	const _find_reference = function(chunk, stream) {

		let ref = {
			chunk:  '',
			line:   0,
			column: 0
		};

		let lines = stream.split('\n');
		let line  = lines.findIndex(function(other) {
			return other.trim() === chunk.trim();
		});

		if (line !== -1) {

			ref.chunk = lines[line];
			ref.line  = line + 1;

			let column = lines[line].indexOf(chunk);
			if (column !== -1) {
				ref.column = column + 1;
			}

		}

		return ref;

	};

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

			let body = stream.substr(i1 + 18, i2 - i1 - 15).trim();
			if (body.length > 0) {

				body.split('\n').forEach(function(line, l) {

					let chunk = line.trim();
					if (chunk.startsWith('this.') && chunk.includes('=')) {

						let tmp = chunk.split(/this\.([a-z]+)([\s]+)=([\s]+)(.*);/g).filter(function(ch) {
							return ch.trim() !== '';
						});

						if (tmp.length === 2) {

							let name = tmp[0];
							let prop = _PARSER.detect(tmp[1]);
							if (prop.type === 'undefined' && /^([A-Za-z0-9]+)$/g.test(prop.chunk)) {

								let mutations = _PARSER.mutations(prop.chunk, body);
								if (mutations.length > 0) {

									let val = mutations.find(function(mutation) {
										return mutation.type !== 'undefined';
									});

									if (val !== undefined) {
										prop.type  = val.type;
										prop.value = val.value;
									}

								}

							}

							properties[name] = {
								chunk: chunk,
								value: prop
							};

						}

					}

				});

			}

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

	const _add_event = function(events, event, method) {

		method = typeof method === 'string' ? method : null;


		let cache = events[event.name];
		if (cache === undefined) {

			cache = events[event.name] = {
				name:       event.name,
				methods:    [],
				parameters: event.parameters
			};

			if (method !== null) {
				cache.methods.push(method);
			}

		} else {

			if (method !== null) {

				if (cache.methods.includes(method) === false) {
					cache.methods.push(method);
				}

			}


			let c_params = cache.parameters;
			let e_params = event.parameters;

			if (c_params.length !== e_params.length) {

				if (c_params.length > e_params.length) {

					c_params.forEach(function(param, c) {

						let other = e_params[c];
						if (other !== undefined) {

							if (param.type === 'undefined' && other.type !== 'undefined') {
								param.chunk = other.chunk;
								param.type  = other.type;
								param.value = other.value;
							}

						}

					});

				} else {

					e_params.forEach(function(param, e) {

						let other = c_params[e];
						if (other !== undefined) {

							if (param.type === 'undefined' && other.type !== 'undefined') {
								param.chunk = other.chunk;
								param.type  = other.type;
								param.value = other.value;
							}

						} else if (other === undefined) {
							c_params[e] = param;
						}

					});

				}

			}

		}
	};

	const _parse_events = function(constructor, methods, events, stream, errors) {

		let construct = constructor.body || null;
		if (construct !== null) {

			let ewents = _PARSER.events(construct);
			if (ewents.length > 0) {

				ewents.forEach(function(event) {
					_add_event(events, event);
				});

			}

		}

		for (let mid in methods) {

			let method = methods[mid];
			let body   = method.body;
			let ewents = _PARSER.events(body);
			if (ewents.length > 0) {

				ewents.forEach(function(event) {
					_add_event(events, event, mid);
				});

			}

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

						let body  = code.split(':').slice(1).join(':').trim();
						let chunk = code.split('\n')[0];

						methods[name] = {
							body:       body,
							chunk:      chunk,
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

				let method = methods[mid];
				let params = method.parameters;
				let ref    = _find_reference(method.chunk, stream);
				let values = method.values;

				if (params.length > 0) {

					let found = params.filter(function(other) {
						return other.type === 'undefined' && other.value === undefined;
					}).map(function(other) {
						return other.name;
					});

					if (found.length > 0) {

						if (/^(control|render|update|deserialize|serialize)$/g.test(mid) === false) {

							let key = found[0];
							let col = ref.chunk.indexOf(key);
							if (col !== -1) {
								col = col + 1;
							} else {
								col = ref.column;
							}

							errors.push({
								ruleId:     'no-parameter-value',
								methodName: mid,
								fileName:   null,
								message:    'Invalid parameter values for "' + found.join('", "') + '" for method "' + mid + '()".',
								line:       ref.line,
								column:     col
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
							message:    'Invalid return value for method "' + mid + '()".',
							line:       ref.line,
							column:     ref.column
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
							message:    'No valid return values for method "' + mid + '()".',
							line:       ref.line,
							column:     ref.column
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

			asset = _validate_asset(asset) === true ? asset : null;


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

			if (asset !== null) {

				let stream = asset.buffer.toString('utf8');

				_parse_memory(memory, stream, errors);
				_parse_constructor(result.constructor, stream, errors);
				_parse_settings(result.settings, stream, errors);
				_parse_properties(result.properties, stream, errors);
				_parse_enums(result.enums, stream, errors);
				_parse_methods(result.methods, stream, errors);
				_parse_events(result.constructor, result.methods, result.events, stream, errors);


				if (result.constructor.parameters.length === 1) {

					let check = result.constructor.parameters[0];
					if (check.name === 'data' || check.name === 'settings') {

						check.type = 'Object';

					} else if (/^(main|client|remote|server)$/g.test(check.name) === false) {

						let chunk = result.constructor.body.split('\n')[0];
						let ref   = _find_reference('\n\tlet Composite = ' + chunk, stream);

						errors.push({
							ruleId:     'no-composite',
							methodName: 'constructor',
							fileName:   null,
							message:    'Composite has no "settings" object.',
							line:       ref.line,
							column:     ref.column
						});

					}

				}


				for (let p in result.properties) {

					let property = result.properties[p];
					if (property.value.type === 'undefined') {

						let method = result.methods['set' + p.charAt(0).toUpperCase() + p.substr(1)] || null;
						if (method !== null) {

							let found = method.parameters.find(function(val) {
								return p === val.name;
							});

							if (found !== undefined && found.type !== 'undefined') {
								property.value.type = found.type;
							}

						}

					}

					if (property.value.type === 'undefined' && property.value.value === undefined) {

						let ref = _find_reference(property.chunk, stream);

						errors.push({
							ruleId:       'no-property-value',
							propertyName: p,
							fileName:     null,
							message:      'Unguessable property "' + p + '".',
							line:         ref.line,
							column:       ref.column
						});

					}

				}


				if (
					result.methods['serialize'] === undefined
					|| result.methods['deserialize'] === undefined
				) {

					let ref = _find_reference('\n\tComposite.prototype =', stream);

					if (result.methods['serialize'] === undefined) {

						errors.push({
							ruleId:     'no-serialize',
							methodName: 'serialize',
							fileName:   null,
							message:    'No "serialize()" method.',
							line:       ref.line,
							column:     ref.column
						});

					}

					if (result.methods['deserialize'] === undefined) {

						errors.push({
							ruleId:     'no-deserialize',
							methodName: 'deserialize',
							fileName:   null,
							message:    'No "deserialize()" method.',
							line:       ref.line,
							column:     ref.column
						});

					}

				}

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

