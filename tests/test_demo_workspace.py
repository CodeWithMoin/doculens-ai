from app.services.demo_workspace import DEMO_DOCUMENTS, DEMO_QUESTIONS


def test_demo_questions_cover_every_document_with_valid_citations() -> None:
    documents = {document.slug: document for document in DEMO_DOCUMENTS}

    assert {question.slug for question in DEMO_QUESTIONS} == set(documents)
    assert len(DEMO_QUESTIONS) == len(documents)

    for question in DEMO_QUESTIONS:
        assert question.question
        assert question.answer
        assert question.reasoning
        assert 0 <= question.confidence <= 1
        assert question.chunk_indexes
        assert all(1 <= index <= len(documents[question.slug].chunks) for index in question.chunk_indexes)
