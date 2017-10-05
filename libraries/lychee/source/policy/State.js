
lychee.define('lychee.policy.State').exports(function(lychee, global, attachments) {

	/*
	 * IMPLEMENTATION
	 */

	const Composite = function(settings) {

		this.entity = settings.entity instanceof Object ? settings.entity : null;
		this.limit  = settings.limit instanceof Array   ? settings.limit  : [ 'default', 'active' ];

	};


	Composite.prototype = {

		/*
		 * ENTITY API
		 */

		// deserialize: function(blob) {},

		serialize: function() {

			let settings = {
				entity: null,
				limit:  this.limit
			};


			return {
				'constructor': 'lychee.policy.State',
				'arguments':   [ settings ]
			};

		},



		/*
		 * CUSTOM API
		 */

		sensor: function() {

			let entity = this.entity;
			let limit  = this.limit;
			let values = [ 0.5 ];


			if (entity !== null) {

				let index = limit.indexOf(entity.state);
				if (index !== -1) {
					values[0] = (index / limit.length);
				}

			}


			return values;

		},

		control: function(values) {

			let entity = this.entity;
			let limit  = this.limit;


			if (entity !== null) {

				let index = (values[0] * limit.length) | 0;
				if (index >= 0) {

					if (typeof entity.setState === 'function') {

						entity.setState(limit[index]);

						return true;

					}

				}

			}


			return false;

		}

	};


	return Composite;

});

