
lychee.define('game.Renderer').includes([
	'lychee.Renderer'
]).requires([
	'game.Camera',
	'game.Compositor'
]).exports(function(lychee, global, attachments) {

	const _Camera     = lychee.import('game.Camera');
	const _Compositor = lychee.import('game.Compositor');
	const _Renderer   = lychee.import('lychee.Renderer');



	/*
	 * IMPLEMENTATION
	 */

	let Composite = function(data) {

		let settings = Object.assign({}, data);

		this.camera     = null;
		this.compositor = null;


		this.setCamera(settings.camera);
		this.setCompositor(settings.compositor);

		delete settings.camera;
		delete settings.compositor;


		_Renderer.call(this, settings);

		settings = null;

	};

	Composite.prototype = {

		/*
		 * ENTITY API
		 */

		deserialize: function(blob) {

			let camera = lychee.deserialize(blob.camera);
			if (camera !== null) {
				this.setCamera(camera);
			}

			let compositor = lychee.deserialize(blob.compositor);
			if (compositor !== null) {
				this.setCompositor(compositor);
			}

		},

		serialize: function() {

			let data = _Renderer.prototype.serialize.call(this);
			data['constructor'] = 'game.Renderer';

			let settings = (data['arguments'][0] || {});
			let blob     = (data['blob'] || {});


			if (this.camera !== null)     blob.camera     = lychee.serialize(this.camera);
			if (this.compositor !== null) blob.compositor = lychee.serialize(this.compositor);


			data['arguments'][0] = settings;
			data['blob']         = Object.keys(blob).length > 0 ? blob : null;


			return data;

		},



		/*
		 * CUSTOM API
		 */

		setCamera: function(camera) {

			camera = camera instanceof _Camera ? camera : null;


			if (camera !== null) {

				this.camera = camera;

				return true;

			}


			return false;

		},

		setCompositor: function(compositor) {

			compositor = compositor instanceof _Compositor ? compositor : null;


			if (compositor !== null) {

				this.compositor = compositor;

				return true;

			}


			return false;

		},

		renderEntity: function(entity, offsetX, offsetY) {

			entity  = entity instanceof Object ? entity : null;
			offsetX = offsetX | 0;
			offsetY = offsetY | 0;


			if (entity !== null && typeof entity.render === 'function') {

				entity.render(
					this,
					offsetX || 0,
					offsetY || 0,
					this.camera,
					this.compositor
				);

				return true;

			}


			return false;

		}

	};


	return Composite;

});

