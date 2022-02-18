'use strict';

const { get } = require('axios')

class Handler {
	constructor({ rekoSvc, translatorSvc }) {
		this.rekoSvc = rekoSvc
		this.translatorSvc = translatorSvc
	}

	async detectImageLabels(buffer) {
		const result = await this.rekoSvc.detectLabels({
			Image: {
				Bytes: buffer
			}
		}).promise()

		const labels = result.Labels
			.filter(({ Confidence }) => Confidence > 80)

		const names = labels.map(({ Name }) => Name).join(' and ')

		return { names, labels }
	}

	async translateText(text) {
		const params = {
			SourceLanguageCode: 'en',
			TargetLanguageCode: 'pt',
			Text: text
		}

		const { TranslatedText } = await this.translatorSvc.translateText(params).promise()

		return TranslatedText.split(' e ')
	}

	formatTextResults(texts, labels) {
		const finalText = []

		for (const textIndex in texts) {
			const nameInPortuguese = texts[textIndex]
			const confidence = labels[textIndex].Confidence

			finalText.push(
				`\n ${confidence.toFixed(2)}% de chance de ser do tipo ${nameInPortuguese}`
			)
		}

		return finalText;
	}

	async getImageBuffer(imageUrl) {
		const response = await get(imageUrl, {
			responseType: 'arraybuffer'
		})

		const buffer = Buffer.from(response.data, 'base64')

		return buffer
	}

	async main(event) {
		try {
			const { imageUrl } = event.queryStringParameters

			const imgBuffer = await this.getImageBuffer(imageUrl)

			const { names, labels } = await this.detectImageLabels(imgBuffer)

			const texts = await this.translateText(names)

			const finalText = this.formatTextResults(texts, labels)

			return {
				statusCode: 200,
				body: 'A imagem tem'.concat(finalText)
			}
		} catch (err) {
			console.log('Error::', err.stack)

			return {
				statusCode: 500,
				body: 'Internal server error'
			}
		}
	} 
}

// factory
const aws = require('aws-sdk')
const reko = new aws.Rekognition()
const translator = new aws.Translate()
const handler = new Handler({
	rekoSvc: reko,
	translatorSvc: translator
});

module.exports.main = handler.main.bind(handler)
