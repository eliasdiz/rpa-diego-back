<records-record-layout-item
	class="slds-form__item slds-no-space slds-size_1-of-2 item-left"
	field-label="Solución"
	lwc-2qpe2t0sbck-host=""
>
	<div
		lwc-2qpe2t0sbck=""
		class="slds-grid slds-size_1-of-1 label-stacked"
		data-target-selection-name="sfdc:RecordField.Lead.SolucionCandidatos__c"
		role="listitem"
	>
		<div
			lwc-2qpe2t0sbck=""
			class="slds-form-element slds-hint-parent test-id__output-root slds-form-element_edit slds-form-element_readonly is-stacked is-stacked-not-editing"
		>
			<div
				lwc-2qpe2t0sbck=""
				class="test-id__field-label-container slds-form-element__label no-utility-icon"
			>
				<span class="test-id__field-label" lwc-2qpe2t0sbck="">Solución</span>
			</div>
			<div lwc-2qpe2t0sbck="" class="slds-form-element__control">
				<span
					lwc-2qpe2t0sbck=""
					class="test-id__field-value slds-form-element__static slds-grow word-break-ie11"
				>
					<slot lwc-2qpe2t0sbck="" name="outputField">
						<force-lookup
							data-output-element-id="output-field"
							slot="outputField"
							lwc-47ngqe6rvah-host=""
						>
							<div lwc-47ngqe6rvah="" class="slds-grid">
								<records-hoverable-link
									lwc-47ngqe6rvah=""
									class="slds-grow"
									data-navigation="enable"
									tabindex="-1"
									lwc-oj46kgc6r3-host=""
								>
									<div lwc-oj46kgc6r3="" class="slds-grid">
										<a
											lwc-oj46kgc6r3=""
											href="/lightning/r/Product2/01td0000000n9XVAAY/view"
											data-navigation="enable"
											data-proxy-id="aura-pos-lib-1"
											id="window"
										>
											<span lwc-oj46kgc6r3="">
												<slot lwc-oj46kgc6r3="">
													<span lwc-47ngqe6rvah="">
														<slot lwc-47ngqe6rvah="">
															<span lwc-47ngqe6rvah="">SALUD FAMILIAR</span>
														</slot>
													</span>
												</slot>
											</span>
										</a>
									</div>
								</records-hoverable-link>
							</div>
						</force-lookup>
					</slot>
				</span>
			</div>
		</div>
	</div>
</records-record-layout-item>