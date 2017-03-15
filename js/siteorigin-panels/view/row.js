var panels = window.panels, $ = jQuery;

module.exports = Backbone.View.extend( {
	template: _.template( $( '#siteorigin-panels-builder-row' ).html().panelsProcessTemplate() ),

	events: {
		'click .so-row-settings': 'editSettingsHandler',
		'click .so-row-duplicate': 'duplicateHandler',
		'click .so-row-delete': 'confirmedDeleteHandler'
	},

	builder: null,
	dialog: null,

	/**
	 * Initialize the row view
	 */
	initialize: function () {

        var rowCells = this.model.get('cells');
		rowCells.on( 'add', this.handleCellAdd, this );
		rowCells.on( 'remove', this.handleCellRemove, this );
		this.model.on( 'reweight_cells', this.resize, this );

		this.model.on( 'destroy', this.onModelDestroy, this );
		this.model.on( 'visual_destroy', this.visualDestroyModel, this );

		var thisView = this;
		rowCells.each( function ( cell ) {
			thisView.listenTo( cell.get('widgets'), 'add', thisView.resize );
		} );

		// When ever a new cell is added, listen to it for new widgets
		rowCells.on( 'add', function ( cell ) {
			thisView.listenTo( cell.get('widgets'), 'add', thisView.resize );
		}, this );

	},

	/**
	 * Render the row.
	 *
	 * @returns {panels.view.row}
	 */
	render: function () {
		this.setElement( this.template() );
		this.$el.data( 'view', this );

		// Create views for the cells in this row
		var thisView = this;
		this.model.get('cells').each( function ( cell ) {
			var cellView = new panels.view.cell( {
				model: cell
			} );
			cellView.row = thisView;
			cellView.render();
			cellView.$el.appendTo( thisView.$( '.so-cells' ) );
		} );

		// Remove any unsupported actions
		if( ! this.builder.supports( 'rowAction' ) ) {
			this.$('.so-row-toolbar .so-dropdown-wrapper' ).remove();
			this.$el.addClass('so-row-no-actions');
		}
		else {
			if( ! this.builder.supports( 'editWidget' ) ) {
				this.$('.so-row-toolbar .so-row-settings' ).parent().remove();
				this.$el.addClass('so-row-no-edit');
			}
			if( ! this.builder.supports( 'addWidget' ) ) {
				this.$('.so-row-toolbar .so-row-duplicate' ).parent().remove();
				this.$el.addClass('so-row-no-duplicate');
			}
			if( ! this.builder.supports( 'deleteWidget' ) ) {
				this.$('.so-row-toolbar .so-row-delete' ).parent().remove();
				this.$el.addClass('so-row-no-delete');
			}
		}
		if( ! this.builder.supports( 'moveRow' ) ) {
			this.$('.so-row-toolbar .so-row-move' ).remove();
			this.$el.addClass('so-row-no-move');
		}
		if( !$.trim( this.$('.so-row-toolbar').html() ).length ) {
			this.$('.so-row-toolbar' ).remove();
		}

		// Resize the rows when ever the widget sortable moves
		this.builder.on( 'widget_sortable_move', this.resize, this );
		this.builder.on( 'builder_resize', this.resize, this );

		this.resize();

		return this;
	},

	/**
	 * Give a visual indication of the creation of this row
	 */
	visualCreate: function () {
		this.$el.hide().fadeIn( 'fast' );
	},

	/**
	 * Visually resize the row so that all cell heights are the same and the widths so that they balance to 100%
	 *
	 * @param e
	 */
	resize: function ( e ) {
		// Don't resize this
		if ( ! this.$el.is( ':visible' ) ) {
			return;
		}

		// Reset everything to have an automatic height
		this.$( '.so-cells .cell-wrapper' ).css( 'min-height', 0 );

		// We'll tie the values to the row view, to prevent issue with values going to different rows
		var height = 0;
		this.$( '.so-cells .cell' ).each( function () {
			height = Math.max(
				height,
				$( this ).height()
			);

			$( this ).css(
				'width',
				( $( this ).data( 'view' ).model.get( 'weight' ) * 100) + "%"
			);
		} );

		// Resize all the grids and cell wrappers
		this.$( '.so-cells .cell-wrapper' ).css( 'min-height', Math.max( height, 64 ) );
	},

	/**
	 * Remove the view from the dom.
	 */
	onModelDestroy: function () {
		this.remove();
	},

	/**
	 * Fade out the view and destroy the model
	 */
	visualDestroyModel: function () {
		this.builder.addHistoryEntry( 'row_deleted' );
		var thisView = this;
		this.$el.fadeOut( 'normal', function () {
			thisView.model.destroy();
			thisView.builder.model.refreshPanelsData();
		} );
	},

	/**
	 * Duplicate this row.
	 *
	 * @return {boolean}
	 */
	duplicateHandler: function () {
		this.builder.addHistoryEntry( 'row_duplicated' );

		var duplicateRow = this.model.clone( this.builder.model );

		this.builder.model.get('rows').add( duplicateRow, {
			at: this.builder.model.get('rows').indexOf( this.model ) + 1
		} );

		this.builder.model.refreshPanelsData();
	},

	/**
	 * Copy the row to a localStorage
	 */
	copyHandler: function(){
		if ( typeof(Storage) === "undefined" || ! panelsOptions.user ) return;

		var serial = panels.serial.serialize( this.model );
		serial.thingType = 'row-model';

		// Store this in the cookie
		localStorage[ 'panels_clipboard_' + panelsOptions.user ] = JSON.stringify( serial );
	},

	/**
	 * Create a new row and insert it
	 */
	pasteHandler: function(){
		if ( typeof(Storage) === "undefined" || ! panelsOptions.user ) return;

		var clipboardObject = localStorage[ 'panels_clipboard_' + panelsOptions.user ];
		if( clipboardObject !== undefined ) {
			clipboardObject = JSON.parse( clipboardObject );
			if( clipboardObject.thingType === 'row-model' ) {
				// Create the model
				this.builder.addHistoryEntry( 'row_pasted' );
				var pastedRow = panels.serial.unserialize( clipboardObject, 'row-model', this.builder.model );
				this.builder.model.get('rows').add( pastedRow, {
					at: this.builder.model.get('rows').indexOf( this.model ) + 1
				} );
			}
		}
	},

	/**
	 * Handles deleting the row with a confirmation.
	 */
	confirmedDeleteHandler: function ( e ) {
		var $$ = $( e.target );

		// The user clicked on the dashicon
		if ( $$.hasClass( 'dashicons' ) ) {
			$$ = $.parent();
		}

		if ( $$.hasClass( 'so-confirmed' ) ) {
			this.visualDestroyModel();
		} else {
			var originalText = $$.html();

			$$.addClass( 'so-confirmed' ).html(
				'<span class="dashicons dashicons-yes"></span>' + panelsOptions.loc.dropdown_confirm
			);

			setTimeout( function () {
				$$.removeClass( 'so-confirmed' ).html( originalText );
			}, 2500 );
		}
	},

	/**
	 * Handle displaying the settings dialog
	 */
	editSettingsHandler: function () {
		// Lets open up an instance of the settings dialog
		if ( this.dialog === null ) {
			// Create the dialog
			this.dialog = new panels.dialog.row();
			this.dialog.setBuilder( this.builder ).setRowModel( this.model );
		}

		this.dialog.openDialog();

		return this;
	},

	/**
	 * Handle deleting this entire row.
	 */
	deleteHandler: function () {
		this.model.destroy();
		return this;
	},

	/**
	 * Handle a new cell being added to this row view. For now we'll assume the new cell is always last
	 */
	handleCellAdd: function ( cell ) {
		var cellView = new panels.view.cell( {
			model: cell
		} );
		cellView.row = this;
		cellView.render();
		cellView.$el.appendTo( this.$( '.so-cells' ) );
	},

	/**
	 * Handle a cell being removed from this row view
	 */
	handleCellRemove: function ( cell ) {
		// Find the view that ties in to the cell we're removing
		this.$( '.so-cells > .cell' ).each( function () {
			var view = $( this ).data( 'view' );
			if ( _.isUndefined( view ) ) {
				return;
			}

			if ( view.model.cid === cell.cid ) {
				// Remove this view
				view.remove();
			}
		} );
	},

	/**
	 * Build up the contextual menu for a row
	 *
	 * @param e
	 * @param menu
	 */
	buildContextualMenu: function ( e, menu ) {
		var options = [];
		for ( var i = 1; i < 5; i ++ ) {
			options.push( {
				title: i + ' ' + panelsOptions.loc.contextual.column
			} );
		}

		if( this.builder.supports( 'addRow' ) ) {
			menu.addSection(
				'add-row',
				{
					sectionTitle: panelsOptions.loc.contextual.add_row,
					search: false
				},
				options,
				function ( c ) {
					this.builder.addHistoryEntry( 'row_added' );

					var columns = Number( c ) + 1;
					var weights = [];
					for ( var i = 0; i < columns; i ++ ) {
						weights.push( {weight: 100 / columns } );
					}

					// Create the actual row
					var newRow = new panels.model.row( {
						collection: this.collection
					} );

                    var cells = new panels.collection.cells(weights);
                    cells.each(function (cell) {
                        cell.row = newRow;
                    });
                    newRow.setCells(cells);
					newRow.builder = this.builder.model;

					this.builder.model.get('rows').add( newRow, {
						at: this.builder.model.get('rows').indexOf( this.model ) + 1
					} );

					this.builder.model.refreshPanelsData();
				}.bind( this )
			);
		}

		actions = {};

		if( this.builder.supports( 'editRow' ) ) {
			actions.edit = { title: panelsOptions.loc.contextual.row_edit };
		}

		// Copy and paste functions
		if ( typeof(Storage) !== "undefined" && panelsOptions.user ) {
			actions.copy = { title: panelsOptions.loc.contextual.row_copy };
			if ( this.builder.supports( 'addRow' ) ) {
				var clipboardObject = localStorage[ 'panels_clipboard_' + panelsOptions.user ];
				if( clipboardObject !== undefined ) {
					clipboardObject = JSON.parse( clipboardObject );
					if( clipboardObject.thingType === 'row-model' ) {
						actions.paste = { title: panelsOptions.loc.contextual.row_paste };
					}
				}
			}
		}

		if( this.builder.supports( 'addRow' ) ) {
			actions.duplicate = { title: panelsOptions.loc.contextual.row_duplicate };
		}

		if( this.builder.supports( 'deleteRow' ) ) {
			actions.delete = { title: panelsOptions.loc.contextual.row_delete, confirm: true };
		}

		if( ! _.isEmpty( actions ) ) {
			menu.addSection(
				'row-actions',
				{
					sectionTitle: panelsOptions.loc.contextual.row_actions,
					search: false,
				},
				actions,
				function ( c ) {
					switch ( c ) {
						case 'edit':
							this.editSettingsHandler();
							break;
						case 'copy':
							this.copyHandler();
							break;
						case 'paste':
							this.pasteHandler();
							break;
						case 'duplicate':
							this.duplicateHandler();
							break;
						case 'delete':
							this.visualDestroyModel();
							break;
					}
				}.bind( this )
			);
		}
	},
} );
