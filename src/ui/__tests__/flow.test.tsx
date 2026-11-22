import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeAll, describe, expect, it } from 'vitest';
import { NoAuthService } from '../../auth';
import { InMemoryEventRepository, type EventRepository } from '../../data';
import { encodeReveal, LocalLinkService } from '../../links';
import { AppRoutes, ServicesProvider } from '../App';

beforeAll(() => {
  // jsdom não implementa <dialog>.showModal
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
});

function renderApp(path = '/', repo: EventRepository = new InMemoryEventRepository()) {
  render(
    <ServicesProvider
      services={{ repository: repo, auth: new NoAuthService(), links: new LocalLinkService(repo) }}
    >
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </ServicesProvider>,
  );
  return repo;
}

describe('fluxo do organizador', () => {
  it('cria evento, gere participantes, sorteia e mostra os links', async () => {
    const user = userEvent.setup();
    const repo = renderApp();

    await user.click(await screen.findByRole('link', { name: 'Novo evento' }));
    await user.type(screen.getByLabelText('Nome do evento'), 'Natal 🎄');
    await user.type(screen.getByLabelText('Orçamento máximo (€)'), '20');
    await user.type(screen.getByLabelText('Data da troca'), '2026-12-24');
    await user.click(screen.getByRole('button', { name: 'Criar evento' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Natal 🎄' })).toBeInTheDocument();
    const draw = screen.getByRole('button', { name: 'Fazer sorteio' });
    expect(draw).toBeDisabled();

    const input = screen.getByLabelText('Nome do participante');
    for (const name of ['Ana', 'Rui', 'Eva']) {
      await user.type(input, name);
      await user.click(screen.getByRole('button', { name: 'Adicionar' }));
      await screen.findByText(name);
    }

    // Duplicado (sem distinguir maiúsculas)
    await user.type(input, 'ANA');
    await user.click(screen.getByRole('button', { name: 'Adicionar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Já existe');
    await user.clear(input);

    // Editar
    await user.click(screen.getByRole('button', { name: 'Editar Rui' }));
    const edit = screen.getByLabelText('Novo nome para Rui');
    await user.clear(edit);
    await user.type(edit, 'Rúben');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Rúben')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Fazer sorteio' }));
    expect(await screen.findByRole('heading', { name: 'Links pessoais' })).toBeInTheDocument();
    const cards = within(
      await screen.findByRole('list', { name: 'Links por participante' }),
    ).getAllByRole('listitem');
    expect(cards).toHaveLength(3);
    expect(await screen.findByRole('button', { name: 'Copiar link de Ana' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Partilhar link com Eva' })).toBeInTheDocument();

    const [saved] = await repo.list();
    const firstDrawId = saved!.draw!.id;

    // Repetir sorteio com aviso
    await user.click(screen.getByRole('button', { name: 'Repetir sorteio' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('deixam de corresponder ao resultado atual');
    await user.click(within(dialog).getByRole('button', { name: 'Repetir sorteio' }));
    await screen.findByRole('status');
    const [after] = await repo.list();
    expect(after!.draw!.id).not.toBe(firstDrawId);
  });

  it('apaga um evento depois de confirmar', async () => {
    const user = userEvent.setup();
    const repo = new InMemoryEventRepository([
      {
        id: 'e1',
        name: 'Escritório',
        budgetCents: 1500,
        exchangeDate: '2026-12-19',
        participants: [],
        exclusions: [],
        draw: null,
        ownerId: null,
        createdAt: '2026-11-01T00:00:00Z',
        updatedAt: '2026-11-01T00:00:00Z',
      },
    ]);
    renderApp('/', repo);
    await user.click(await screen.findByRole('button', { name: 'Apagar Escritório' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Apagar' }));
    expect(await screen.findByText('Ainda não tens eventos.')).toBeInTheDocument();
  });
});

describe('concorrência', () => {
  it('não perde participantes adicionados mais depressa do que a gravação', async () => {
    class SlowRepo extends InMemoryEventRepository {
      override async save(e: Parameters<InMemoryEventRepository['save']>[0]) {
        await new Promise((r) => setTimeout(r, 30));
        return super.save(e);
      }
    }
    const repo = new SlowRepo([
      {
        id: 'e1',
        name: 'Natal',
        budgetCents: 1500,
        exchangeDate: '2026-12-19',
        participants: [],
        exclusions: [],
        draw: null,
        ownerId: null,
        createdAt: '2026-11-01T00:00:00Z',
        updatedAt: '2026-11-01T00:00:00Z',
      },
    ]);
    renderApp('/eventos/e1', repo);
    const input = await screen.findByLabelText('Nome do participante');
    for (const name of ['Ana', 'Rui', 'Eva', 'Zé']) {
      fireEvent.change(input, { target: { value: name } });
      fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }));
    }
    await waitFor(async () =>
      expect((await repo.get('e1'))!.participants.map((p) => p.name)).toEqual([
        'Ana',
        'Rui',
        'Eva',
        'Zé',
      ]),
    );
  });
});

describe('revelação', () => {
  const code = encodeReveal({
    eventName: 'Natal',
    budgetCents: 2000,
    exchangeDate: '2026-12-24',
    giverName: 'Inês',
    receiverName: 'João 🎅',
    drawId: 'abcd1234',
  });

  it('mostra o envelope e revela ao tocar', async () => {
    const user = userEvent.setup();
    renderApp(`/r/${code}`);
    expect(await screen.findByRole('heading', { name: 'Olá, Inês!' })).toBeInTheDocument();
    expect(screen.queryByText('João 🎅')).not.toBeInTheDocument();
    expect(screen.queryByText(/sorteio mais recente/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Abrir envelope/ }));
    expect(screen.getByText('João 🎅')).toBeInTheDocument();
    expect(screen.getByText(/20\s?€/)).toBeInTheDocument();
    expect(screen.getByText('24 de dezembro de 2026')).toBeInTheDocument();
  });

  it('mostra erro com link inválido', async () => {
    renderApp('/r/lixo');
    expect(await screen.findByRole('heading', { name: 'Link inválido' })).toBeInTheDocument();
  });

  it('o campo "Tenho um código" aceita o link completo', async () => {
    const user = userEvent.setup();
    renderApp('/codigo');
    await user.type(
      screen.getByLabelText('Código ou link'),
      `https://x.github.io/Mystery-gift/#/r/${code}`,
    );
    await user.click(screen.getByRole('button', { name: 'Abrir envelope' }));
    expect(await screen.findByRole('heading', { name: 'Olá, Inês!' })).toBeInTheDocument();
  });

  it('o campo "Tenho um código" rejeita códigos inválidos', async () => {
    const user = userEvent.setup();
    renderApp('/codigo');
    await user.type(screen.getByLabelText('Código ou link'), 'abc');
    await user.click(screen.getByRole('button', { name: 'Abrir envelope' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Código inválido');
  });
});
