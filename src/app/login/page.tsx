import Header from '@/components/layout/Header';
import LoginForm from './LoginForm';

export default function LoginPage() {
    return (
        <div className="flex flex-col min-h-screen">
            <Header />

            <main className="flex-grow flex items-center justify-center pt-20 px-6">
                <LoginForm />
            </main>
        </div>
    );
}
