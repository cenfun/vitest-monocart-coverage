export default async () => {
    const { MonocartProvider } = await import('./provider.js');
    return new MonocartProvider();
};
