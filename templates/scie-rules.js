/* Shared by the term editor and by the OS save handler. */
const SCIE = {
    installation: 'TRSI',
    maintenance: 'TRSM',
    errors(state) {
        const values = state.values || {};
        const required = [
            'native-instalacao', 'native-morada', 'native-cliente', 'sign_tecnico_nome',
            'scie-tech-nif', 'scie-equipment', 'scie-company', 'scie-company-nif',
            'scie-anepc', 'native-data', 'scie-equipment-list',
            state.type === this.installation ? 'scie-certificates' : 'scie-maintenance',
        ];
        const errors = [];
        if (required.some(id => !String(values[id] || '').trim())) {
            errors.push('Preenche os dados do termo e a lista do anexo, incluindo as referências dos certificados no termo de instalação.');
        }
        if (values['scie-confirm'] !== 'yes') errors.push('Confirma a declaração antes de concluir.');
        return errors;
    },
};
