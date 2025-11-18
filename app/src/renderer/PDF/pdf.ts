import '../assets/style.css'
import '@deta/ui/src/app.css'
import 'iconify-icon'
import PDF from './components/PDF.svelte'
import { mount } from 'svelte'
import '@pdfslick/core/dist/pdf_viewer.css'
import { registerRuntimeEnv } from '@deta/utils/system/runtimeEnv'

registerRuntimeEnv(import.meta.env)

const app = mount(PDF, {
  target: document.getElementById('app')
})

export default app
